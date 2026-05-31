use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::cache::ImageDetails;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummonerData {
    pub id: String,
    pub name: String,
    pub key: String,
    pub image: ImageDetails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summoner {
    #[serde(rename = "type")]
    pub file_type: String,
    pub data: HashMap<String, SummonerData>,
}
