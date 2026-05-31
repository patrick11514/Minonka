use serde::{Deserialize, Serialize};

pub mod challenges;
pub mod champion;
pub mod runes;
pub mod summoner;

pub mod ddragon;
pub mod json;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDetails {
    pub full: String,
    pub sprite: String,
    pub group: String,
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
}
