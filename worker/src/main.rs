use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::time::{Duration, sleep};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, protocol::Message},
};

use worker::{context::AppContext, tasks};

#[tokio::main]
async fn main() {
    // In a real app, you would load these from your .env file
    let host = std::env::var("WEBSOCKET_HOST").unwrap_or_else(|_| "ws://localhost".to_string());
    let port = std::env::var("WEBSOCKET_PORT").unwrap_or_else(|_| "8080".to_string());
    let url_string = format!("{}:{}", host, port);

    println!("Worker Started. Target: {}", url_string);

    // The outer loop handles the 5-second reconnect logic automatically
    loop {
        println!("Connecting to server...");

        match setup_websocket(&url_string).await {
            Ok(_) => println!("Connection closed gracefully."),
            Err(e) => eprintln!("Connection error: {}. Reconnecting in 5 seconds...", e),
        }

        // Wait 5 seconds before trying to reconnect, exactly like setTimeout in JS
        sleep(Duration::from_secs(5)).await;
    }
}

async fn setup_websocket(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    //app state
    let context = AppContext::new().await;

    let (ws_stream, _) = connect_async(url.into_client_request().unwrap()).await?;
    println!("Connected to server!");

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
                eprintln!("Received malformed message: {}", text);
                continue;
            }

            let job_name = parts[0].to_string();
            let job_id = parts[1].to_string();
            let start_date = parts[2].to_string();
            let str_data = parts[3].to_string();

            println!("Got job '{}' with id '{}'", job_name, job_id);

            // fs::write(format!("test_files/{}.json", job_name), &str_data).ok();

            let write_clone = std::sync::Arc::clone(&write_stream);
            let context_clone = context.clone();

            tokio::spawn(async move {
                let response = match tasks::dispatch(&job_name, &str_data, context_clone).await {
                    Ok(result) => {
                        let json = serde_json::to_string(&result)
                            .unwrap_or_else(|_| json!({ "type": "temp", "data": "" }).to_string());
                        format!("completed;{};{};{}", job_id, json, start_date)
                    }
                    Err(err) => {
                        let message = err.to_string().replace(';', ",");
                        format!("error;{};{};;{}", job_id, message, start_date)
                    }
                };

                let mut writer = write_clone.lock().await;
                if let Err(e) = writer.send(Message::Text(response.into())).await {
                    eprintln!("Failed to send job completion: {}", e);
                } else {
                    println!("Job '{}' with id '{}' finished", job_name, job_id);
                }
            });
        }
    }

    Ok(())
}
