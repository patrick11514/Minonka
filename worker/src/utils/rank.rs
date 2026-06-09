use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::{draw::color::Color, utils::locale::AppLocale};

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

    pub fn color(&self) -> Color {
        match self {
            Tier::Iron => Color::Iron,
            Tier::Bronze => Color::Bronze,
            Tier::Silver => Color::Silver,
            Tier::Gold => Color::Gold,
            Tier::Platinum => Color::Platinum,
            Tier::Emerald => Color::Emerald,
            Tier::Diamond => Color::Diamond,
            Tier::Master => Color::Master,
            Tier::Grandmaster => Color::Grandmaster,
            Tier::Challenger => Color::Challenger,
        }
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

    pub fn as_str(&self, locale: &AppLocale) -> String {
        if self.tier < Tier::Master {
            format!(
                "{} {}",
                locale.tier_label(&self.tier.as_str()),
                self.rank.as_str()
            )
        } else {
            locale.tier_label(&self.tier.as_str())
        }
    }
}
