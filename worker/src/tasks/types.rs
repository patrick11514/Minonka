use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub enum WorkerJob {
    #[serde(rename = "cherryMatch")]
    CherryMatch,
    #[serde(rename = "match")]
    Match,
    #[serde(rename = "rank")]
    Rank,
    #[serde(rename = "spectator")]
    Spectator,
    #[serde(rename = "summoner")]
    Summoner,
    #[serde(rename = "team")]
    Team,
}

impl WorkerJob {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::CherryMatch => "cherryMatch",
            Self::Match => "match",
            Self::Rank => "rank",
            Self::Spectator => "spectator",
            Self::Summoner => "summoner",
            Self::Team => "team",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", tag = "type")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub enum FileResult {
    #[serde(rename = "temp")]
    Temp { data: String },
    #[serde(rename = "local")]
    Local { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct DefaultParametersInput {
    pub puuid: String,
    pub region: String,
    pub level: u32,
    pub game_name: String,
    pub tag_line: String,
    pub profile_icon_id: u32,
    pub locale: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchMetadataInput {
    pub match_id: String,
}
