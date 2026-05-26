use std::{sync::Arc, time::Duration};

use serde::de::DeserializeOwned;

use crate::tasks::error::{TaskResult, TaskResultExt};

#[derive(Debug, Clone)]
pub struct DdragonCache {
    cache: Arc<moka::future::Cache<String, serde_json::Value>>,
}

impl DdragonCache {
    pub fn new() -> Self {
        DdragonCache {
            cache: Arc::new(
                moka::future::Cache::builder()
                    .max_capacity(100)
                    .time_to_live(Duration::from_hours(24))
                    .build(),
            ),
        }
    }

    #[tracing::instrument(skip(self), fields(url = %url), err)]
    pub async fn get<T: DeserializeOwned + 'static>(&self, url: &str) -> TaskResult<Option<T>> {
        if let Some(cached) = self.cache.get(url).await {
            Ok(Some(
                serde_json::from_value(cached)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize cached json", url.to_string())?,
            ))
        } else {
            let source_url = format!("https://raw.communitydragon.org/{}", url);
            let response = reqwest::get(&source_url)
                .await
                .map_err(crate::tasks::error::TaskError::Reqwest)
                .context("fetch cache source", source_url.clone())?;
            let data = response
                .json::<serde_json::Value>()
                .await
                .map_err(crate::tasks::error::TaskError::Reqwest)
                .context("parse cache source json", source_url.clone())?;

            if let Ok(json_value) = serde_json::to_value(&data) {
                self.cache.insert(url.to_string(), json_value).await;
            }

            Ok(Some(
                serde_json::from_value(data)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize source json", source_url)?,
            ))
        }
    }
}
