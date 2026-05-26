use std::{sync::Arc, time::Duration};

use serde::de::DeserializeOwned;

use crate::{
    cache::challenges::Challenge,
    tasks::error::{TaskResult, TaskResultExt},
    utils::{
        assets::{Asset, AssetType, asset_path},
        locale::AppLocale,
    },
};

#[derive(Debug, Clone)]
pub struct JsonCache {
    cache: Arc<moka::future::Cache<String, serde_json::Value>>,
}

impl JsonCache {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(
                moka::future::Cache::builder()
                    .max_capacity(100)
                    .time_to_live(Duration::from_hours(24))
                    .build(),
            ),
        }
    }

    fn locale_to_path(locale: &AppLocale) -> String {
        match locale {
            AppLocale::Cz => "cs_CZ",
            AppLocale::En => "en_US",
        }
        .to_string()
    }

    #[tracing::instrument(skip(self), fields(path = %path), err)]
    async fn read_file(&self, path: &str) -> TaskResult<serde_json::Value> {
        let asset = Asset::new(AssetType::DDragon, format!("/_ROOT_/data/{}", path));

        let path = asset_path(&asset).await?;

        let content = tokio::fs::read_to_string(path).await?;

        serde_json::from_str(&content).map_err(crate::tasks::error::TaskError::Json)
    }

    async fn get<T: DeserializeOwned + 'static>(&self, path: &str) -> TaskResult<Option<T>> {
        if let Some(cached) = self.cache.get(path).await {
            Ok(Some(
                serde_json::from_value(cached)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize cached json", path.to_string())?,
            ))
        } else {
            let data = self.read_file(path).await?;

            if let Ok(json_value) = serde_json::to_value(&data) {
                self.cache.insert(path.to_string(), json_value).await;
            }

            Ok(Some(
                serde_json::from_value(data)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize source json", path.to_string())?,
            ))
        }
    }

    pub async fn get_challenges(&self, lang: &AppLocale) -> TaskResult<Option<Vec<Challenge>>> {
        let path = format!("{}/challenges.json", Self::locale_to_path(lang));
        self.get(&path).await
    }
}
