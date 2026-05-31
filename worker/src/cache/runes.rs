use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubRune {
    pub id: u32,
    pub key: String,
    pub icon: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunesSlot {
    pub runes: Vec<SubRune>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rune {
    pub id: u32,
    pub key: String,
    pub icon: String,
    pub name: String,
    pub slots: Vec<RunesSlot>,
}
