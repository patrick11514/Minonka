use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, PartialOrd)]
#[serde(rename_all = "UPPERCASE")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub enum Tier {
    Iron,
    Bronze,
    Silver,
    Gold,
    Platinum,
    Emerald,
    Diamond,
    Master,
    Grandmaster,
    Challenger,
}

impl From<&String> for Tier {
    fn from(s: &String) -> Self {
        match s.as_str() {
            "IRON" => Tier::Iron,
            "BRONZE" => Tier::Bronze,
            "SILVER" => Tier::Silver,
            "GOLD" => Tier::Gold,
            "PLATINUM" => Tier::Platinum,
            "EMERALD" => Tier::Emerald,
            "DIAMOND" => Tier::Diamond,
            "MASTER" => Tier::Master,
            "GRANDMASTER" => Tier::Grandmaster,
            "CHALLENGER" => Tier::Challenger,
            _ => panic!("Unknown rank tier: {}", s),
        }
    }
}

impl Tier {
    pub fn as_lowercase_str(&self) -> String {
        format!("{:?}", self).to_lowercase()
    }

    pub fn as_str(&self) -> String {
        format!("{:?}", self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "UPPERCASE")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub enum Rank {
    I,
    II,
    III,
    IV,
}

impl Rank {
    pub fn as_str(&self) -> String {
        format!("{:?}", self)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct RankTier {
    tier_index: u32,
    tier: Tier,
    rank_index: u32,
    rank: Rank,
    lp: u32,
}

impl RankTier {
    pub fn rank(&self) -> &Rank {
        &self.rank
    }

    pub fn tier(&self) -> &Tier {
        &self.tier
    }
}
