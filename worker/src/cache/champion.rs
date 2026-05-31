use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::cache::ImageDetails;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Champion {
    #[serde(rename = "type")]
    pub file_type: String,
    pub data: HashMap<String, ChampionData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionData {
    pub id: String,
    pub key: String,
    pub image: ImageDetails,
}
