use std::collections::HashMap;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum RewardCategory {
    Title,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengesReward {
    pub category: RewardCategory,
    pub quantity: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChallengesThreshold {
    pub value: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rewards: Option<Vec<ChallengesReward>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Challenge {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub short_description: String,
    pub has_leaderboard: bool,
    pub thresholds: IndexMap<String, ChallengesThreshold>,
    pub level_to_icon_path: HashMap<String, String>,
}
