use std::fs;

use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::time::{Duration, sleep};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, protocol::Message},
};
use tracing::{Instrument, error, info, warn};

use worker::{context::AppContext, tasks, utils::init_tracing};

#[tokio::main]
async fn main() {
    init_tracing();

    // In a real app, you would load these from your .env file
    let host = std::env::var("WEBSOCKET_HOST").unwrap_or_else(|_| "ws://localhost".to_string());
    let port = std::env::var("WEBSOCKET_PORT").unwrap_or_else(|_| "8080".to_string());
    let url_string = format!("{}:{}", host, port);

    info!(target = "worker", %url_string, "worker started");

    // The outer loop handles the 5-second reconnect logic automatically
    loop {
        info!(target = "worker", "connecting to server");

        match setup_websocket(&url_string).await {
            Ok(_) => info!(target = "worker", "connection closed gracefully"),
            Err(e) => {
                error!(target = "worker", error = %e, "connection error, reconnecting in 5 seconds")
            }
        }

        // Wait 5 seconds before trying to reconnect, exactly like setTimeout in JS
        sleep(Duration::from_secs(5)).await;
    }
}

#[tracing::instrument(skip(url), fields(url = %url), err)]
async fn setup_websocket(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    //app state
    let context = AppContext::new().await?;

    let request = url.into_client_request()?;
    let (ws_stream, _) = connect_async(request).await?;
    info!(target = "worker", "connected to server");

    // Split the stream into a sender (to send results back) and a receiver (to get jobs)
    let (write, mut read) = ws_stream.split();
    let write_stream = std::sync::Arc::new(tokio::sync::Mutex::new(write));

    // Listen for incoming messages
    while let Some(msg) = read.next().await {
        let msg = msg?;

        if let Message::Text(text) = msg {
            // Replicating your Worker.ts persistent check bypass
            if text.starts_with("persistentResult") {
                continue;
            }

            // Parse the message: "job;jobId;startDate;strData"
            let parts: Vec<&str> = text.splitn(4, ';').collect();
            if parts.len() != 4 {
                warn!(target = "worker", payload = %text, "received malformed websocket message");
                continue;
            }

            let job_name = parts[0].to_string();
            let job_id = parts[1].to_string();
            let start_date = parts[2].to_string();
            let str_data = parts[3].to_string();

            let job_span = tracing::info_span!(
                "worker_job",
                job_name = %job_name,
                job_id = %job_id,
                start_date = %start_date
            );

            info!(target = "worker", job_name = %job_name, job_id = %job_id, "received job");

            let write_clone = std::sync::Arc::clone(&write_stream);
            let context_clone = context.clone();

            tokio::spawn(
                async move {
                    let (response, failed) = match tasks::dispatch(&job_name, &str_data, context_clone).await {
                        Ok(result) => {
                            let json = serde_json::to_string(&result)
                                .unwrap_or_else(|_| json!({ "type": "temp", "data": "" }).to_string());
                            (format!("completed;{};{};{}", job_id, json, start_date), false)
                        }
                        Err(err) => {
                            error!(
                                target = "worker",
                                job_name = %job_name,
                                job_id = %job_id,
                                error = %err,
                                error_chain = %tasks::error::format_error_chain(&err),
                                "job execution failed"
                            );
                            let message = err.to_string().replace(';', ",");
                            (format!("error;{};{};;{}", job_id, message, start_date), true)
                        }
                    };

                    let mut writer = write_clone.lock().await;
                    if let Err(e) = writer.send(Message::Text(response.into())).await {
                        error!(target = "worker", error = %e, "failed to send job completion");
                    } else if failed {
                        info!(target = "worker", job_name = %job_name, job_id = %job_id, "job failure result sent");
                    } else {
                        info!(target = "worker", job_name = %job_name, job_id = %job_id, "job completed");
                    }
                }
                .instrument(job_span),
            );
        }
    }

    Ok(())
}
