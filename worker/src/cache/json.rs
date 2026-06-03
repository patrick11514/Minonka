use std::{sync::Arc, time::Duration};

use serde::de::DeserializeOwned;

use crate::{
    cache::{
        augments::Augments, challenges::Challenge, champion::Champion, runes::Rune,
        summoner::Summoner,
    },
    tasks::error::{TaskResult, TaskResultExt},
    utils::{
        assets::{Asset, AssetType, OnlineAsset, asset_path},
        locale::AppLocale,
    },
};

#[derive(Debug, Clone)]
pub struct JsonCache {
    cache: Arc<moka::future::Cache<String, serde_json::Value>>,
}

enum GetInput {
    String(String),
    Asset(Asset),
}

impl From<String> for GetInput {
    fn from(value: String) -> Self {
        Self::String(value)
    }
}

impl From<Asset> for GetInput {
    fn from(value: Asset) -> Self {
        Self::Asset(value)
    }
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

    #[tracing::instrument(skip(self), fields(asset = %asset), err)]
    async fn read_file(&self, asset: Asset) -> TaskResult<serde_json::Value> {
        let path = asset_path(&asset).await?;

        let content = tokio::fs::read_to_string(path).await?;

        let mut deserializer = serde_json::Deserializer::from_str(&content);
        serde_path_to_error::deserialize(&mut deserializer)
            .map_err(crate::tasks::error::TaskError::Json)
    }

    async fn get<T: DeserializeOwned + 'static>(&self, input: GetInput) -> TaskResult<Option<T>> {
        let path = match &input {
            GetInput::String(s) => s.clone(),
            GetInput::Asset(asset) => asset.name.clone(),
        };

        if let Some(cached) = self.cache.get(&path).await {
            Ok(Some(
                serde_path_to_error::deserialize(cached)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize cached json", path.to_string())?,
            ))
        } else {
            let data = self
                .read_file(match &input {
                    GetInput::String(s) => {
                        Asset::new(AssetType::DDragon, format!("/_ROOT_/data/{}", s.clone()))
                    }
                    GetInput::Asset(asset) => asset.clone(),
                })
                .await?;

            if let Ok(json_value) = serde_json::to_value(&data) {
                self.cache.insert(path.to_string(), json_value).await;
            }

            Ok(Some(
                serde_path_to_error::deserialize(data)
                    .map_err(crate::tasks::error::TaskError::Json)
                    .context("deserialize source json", path.to_string())?,
            ))
        }
    }

    pub async fn get_challenges(&self, lang: &AppLocale) -> TaskResult<Option<Vec<Challenge>>> {
        let path = format!("{}/challenges.json", Self::locale_to_path(lang));
        self.get(path.into()).await
    }

    pub async fn get_champions(&self, lang: &AppLocale) -> TaskResult<Option<Champion>> {
        let path = format!("{}/champion.json", Self::locale_to_path(lang));
        self.get(path.into()).await
    }

    pub async fn get_runes(&self, lang: &AppLocale) -> TaskResult<Option<Vec<Rune>>> {
        let path = format!("{}/runesReforged.json", Self::locale_to_path(lang));
        self.get(path.into()).await
    }

    pub async fn get_summoner_spells(&self, lang: &AppLocale) -> TaskResult<Option<Summoner>> {
        let path = format!("{}/summoner.json", Self::locale_to_path(lang));
        self.get(path.into()).await
    }

    pub async fn get_aguments(&self, lang: &AppLocale) -> TaskResult<Option<Augments>> {
        let asset = Asset::new(
            AssetType::Online(OnlineAsset::CommunityDragon),
            format!(
                "/cdragon/arena/{}.json",
                Self::locale_to_path(lang).to_lowercase()
            ),
        );

        self.get(asset.into()).await
    }
}
