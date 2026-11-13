use std::{
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};

use serde::de::DeserializeOwned;

use crate::{
    tasks::error::{TaskError, TaskResult, TaskResultExt},
    utils::{
        build_http_client, get_current_dir, get_persistent_cache_folder, write_file_atomic,
    },
};

const CACHE_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const STALE_CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const DEFAULT_BASE_URL: &str = "https://raw.communitydragon.org";

#[derive(Debug, Clone)]
pub struct DdragonCache {
    cache: Arc<moka::future::Cache<String, serde_json::Value>>,
    stale_cache: Arc<moka::future::Cache<String, serde_json::Value>>,
    client: reqwest::Client,
    base_url: String,
    cache_dir: Option<PathBuf>,
}

impl DdragonCache {
    pub fn new() -> Self {
        Self::with_config(DEFAULT_BASE_URL, None)
    }

    pub(crate) fn with_config(base_url: impl Into<String>, cache_dir: Option<PathBuf>) -> Self {
        DdragonCache {
            cache: Arc::new(
                moka::future::Cache::builder()
                    .max_capacity(100)
                    .time_to_live(CACHE_TTL)
                    .build(),
            ),
            stale_cache: Arc::new(
                moka::future::Cache::builder()
                    .max_capacity(100)
                    .time_to_live(STALE_CACHE_TTL)
                    .build(),
            ),
            client: build_http_client(),
            base_url: base_url.into(),
            cache_dir,
        }
    }

    fn disk_cache_path(&self, clean_url: &str) -> PathBuf {
        let rel = if clean_url.is_empty() || clean_url.ends_with('/') {
            format!("{clean_url}index.json")
        } else {
            clean_url.to_string()
        };

        let root = self.cache_dir.clone().unwrap_or_else(|| {
            get_current_dir()
                .join(get_persistent_cache_folder())
                .join("cddragon")
        });

        root.join(rel)
    }

    async fn read_disk_cache(path: &Path) -> Option<(serde_json::Value, bool)> {
        let metadata = tokio::fs::metadata(path).await.ok()?;
        let is_fresh = metadata
            .modified()
            .ok()
            .and_then(|modified| modified.elapsed().ok())
            .is_some_and(|age| age < CACHE_TTL);

        let bytes = tokio::fs::read(path).await.ok()?;
        let value = serde_json::from_slice::<serde_json::Value>(&bytes).ok()?;
        Some((value, is_fresh))
    }

    async fn fetch_json(&self, source_url: &str) -> TaskResult<serde_json::Value> {
        let response = self
            .client
            .get(source_url)
            .send()
            .await
            .map_err(TaskError::Reqwest)
            .context("fetch cache source", source_url.to_string())?;
        let response = response
            .error_for_status()
            .map_err(TaskError::Reqwest)
            .context("status check cache source", source_url.to_string())?;

        response
            .json::<serde_json::Value>()
            .await
            .map_err(TaskError::Reqwest)
            .context("parse cache source json", source_url.to_string())
    }

    fn deserialize<T: DeserializeOwned>(
        value: serde_json::Value,
        operation: &'static str,
        target: &str,
    ) -> TaskResult<T> {
        serde_path_to_error::deserialize(value)
            .map_err(TaskError::Json)
            .context(operation, target.to_string())
    }

    #[tracing::instrument(skip(self), fields(url = %url), err)]
    pub async fn get<T: DeserializeOwned + 'static>(&self, url: &str) -> TaskResult<Option<T>> {
        let clean_url = url.trim_start_matches('/');

        if let Some(cached) = self.cache.get(clean_url).await {
            return Ok(Some(Self::deserialize(
                cached,
                "deserialize cached json",
                clean_url,
            )?));
        }

        let disk_path = self.disk_cache_path(clean_url);
        let disk_entry = Self::read_disk_cache(&disk_path).await;
        if let Some((data, true)) = disk_entry {
            self.cache.insert(clean_url.to_string(), data.clone()).await;
            return Ok(Some(Self::deserialize(
                data,
                "deserialize disk cached json",
                clean_url,
            )?));
        }

        if let Some(stale) = self.stale_cache.get(clean_url).await {
            return Ok(Some(Self::deserialize(
                stale,
                "deserialize stale cached json",
                clean_url,
            )?));
        }

        let source_url = format!("{}/{}", self.base_url.trim_end_matches('/'), clean_url);
        match self.fetch_json(&source_url).await {
            Ok(data) => {
                if let Ok(bytes) = serde_json::to_vec(&data) {
                    if let Err(err) = write_file_atomic(&disk_path, &bytes).await {
                        tracing::warn!(
                            path = %disk_path.display(),
                            error = %err,
                            "Failed to persist CommunityDragon cache to disk"
                        );
                    }
                }
                self.cache.insert(clean_url.to_string(), data.clone()).await;
                Ok(Some(Self::deserialize(
                    data,
                    "deserialize source json",
                    &source_url,
                )?))
            }
            Err(err) => {
                if let Some((stale_data, _)) = disk_entry {
                    tracing::warn!(
                        url = %source_url,
                        error = %err,
                        "Failed to refresh CommunityDragon cache, using stale disk cache"
                    );
                    self.stale_cache
                        .insert(clean_url.to_string(), stale_data.clone())
                        .await;
                    return Ok(Some(Self::deserialize(
                        stale_data,
                        "deserialize stale disk cached json",
                        clean_url,
                    )?));
                }

                Err(err)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
    };

    #[derive(Debug, Deserialize, PartialEq)]
    struct TestItem {
        name: String,
    }

    async fn spawn_mock_server(
        status_line: &'static str,
        body: &'static str,
    ) -> (String, tokio::task::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 1024];
            let n = socket.read(&mut buf).await.unwrap();
            let req = String::from_utf8_lossy(&buf[..n]).to_string();

            let resp = format!(
                "{status_line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            socket.write_all(resp.as_bytes()).await.unwrap();
            req
        });

        (format!("http://{}", addr), handle)
    }

    fn temp_cache_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "minonka-ddragon-test-{}-{}",
            label,
            crate::utils::unique_id()
        ))
    }

    #[tokio::test]
    async fn fetches_normalizes_slashes_and_persists_to_disk() {
        let cache_dir = temp_cache_dir("fetch");
        let (base_url, req_handle) =
            spawn_mock_server("HTTP/1.1 200 OK", r#"[{"name":"00_unranked_banner.png"}]"#).await;

        let cache = DdragonCache::with_config(base_url, Some(cache_dir.clone()));
        let items: Vec<TestItem> = cache
            .get("/json/latest/game/assets/loadouts/regalia/banners/")
            .await
            .unwrap()
            .unwrap();

        assert_eq!(
            items,
            vec![TestItem {
                name: "00_unranked_banner.png".to_string()
            }]
        );

        let raw_req = req_handle.await.unwrap();
        assert!(
            raw_req.starts_with("GET /json/latest/game/assets/loadouts/regalia/banners/ "),
            "unexpected request line: {raw_req}"
        );

        let disk_file = cache_dir.join("json/latest/game/assets/loadouts/regalia/banners/index.json");
        assert!(disk_file.exists());

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn reports_http_error_status_when_no_disk_cache_exists() {
        let cache_dir = temp_cache_dir("status-err");
        let (base_url, _req_handle) = spawn_mock_server("HTTP/1.1 522 Origin Timed Out", "").await;

        let cache = DdragonCache::with_config(base_url, Some(cache_dir.clone()));
        let err = cache
            .get::<Vec<TestItem>>("/json/latest/game/assets/loadouts/regalia/banners/")
            .await
            .unwrap_err();

        let msg = err.to_string();
        assert!(
            msg.contains("status check cache source failed") && msg.contains("522"),
            "expected status error with 522, got: {msg}"
        );

        let _ = std::fs::remove_dir_all(&cache_dir);
    }

    #[tokio::test]
    async fn falls_back_to_stale_disk_cache_on_upstream_error() {
        let cache_dir = temp_cache_dir("stale-fallback");
        let disk_file = cache_dir.join("json/latest/game/assets/loadouts/regalia/banners/index.json");
        std::fs::create_dir_all(disk_file.parent().unwrap()).unwrap();
        std::fs::write(&disk_file, r#"[{"name":"00_unranked_banner.png"}]"#).unwrap();

        // Backdate file mtime by 25 hours so it is treated as stale.
        let stale_time = std::time::SystemTime::now() - Duration::from_secs(25 * 60 * 60);
        let file = std::fs::OpenOptions::new()
            .write(true)
            .open(&disk_file)
            .unwrap();
        file.set_modified(stale_time).unwrap();

        let (base_url, _req_handle) = spawn_mock_server("HTTP/1.1 522 Origin Timed Out", "").await;
        let cache = DdragonCache::with_config(base_url, Some(cache_dir.clone()));

        let items: Vec<TestItem> = cache
            .get("/json/latest/game/assets/loadouts/regalia/banners/")
            .await
            .unwrap()
            .unwrap();

        assert_eq!(
            items,
            vec![TestItem {
                name: "00_unranked_banner.png".to_string()
            }]
        );

        let _ = std::fs::remove_dir_all(&cache_dir);
    }
}
