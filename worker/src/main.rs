use futures_util::{SinkExt, StreamExt};
use tokio::time::{Duration, sleep};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{client::IntoClientRequest, protocol::Message},
};

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
    let (ws_stream, _) = connect_async(url.into_client_request().unwrap()).await?;
    println!("Connected to server!");

    // Split the stream into a sender (to send results back) and a receiver (to get jobs)
    let (mut write, mut read) = ws_stream.split();

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

            let job_name = parts[0];
            let job_id = parts[1];
            let start_date = parts[2];
            let str_data = parts[3];

            println!("Got job '{}' with id '{}'", job_name, job_id);
            println!("Job data: {}", str_data);

            // TODO: Route the job to your image processing modules here
            // Example:
            // let result = handle_job(job_name, str_data).await;

            // For now, we simulate a successful empty completion
            let mock_result_json = "\"{}\""; // In reality, this is the saved file path

            let response = format!("completed;{};{};{}", job_id, mock_result_json, start_date);

            // Send the result back to the server
            if let Err(e) = write.send(Message::Text(response.into())).await {
                eprintln!("Failed to send job completion: {}", e);
            } else {
                println!("Job '{}' with id '{}' completed", job_name, job_id);
            }
        }
    }

    Ok(())
}
