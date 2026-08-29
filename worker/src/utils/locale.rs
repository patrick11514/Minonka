use crate::utils::first_upper;

#[derive(Debug, Clone)]
pub enum AppLocale {
    En,
    Cz,
}

impl AppLocale {
    /// Maps the incoming parameter string to a supported internal locale type.
    pub fn from_str(locale: &str) -> Self {
        match locale.to_lowercase().as_str() {
            "cz" | "cs" | "cs-cz" | "czech" => AppLocale::Cz,
            _ => AppLocale::En,
        }
    }

    pub fn queue_label(&self, queue_type: &str) -> &'static str {
        match (self, queue_type) {
            (AppLocale::Cz, "RANKED_SOLO_5x5") => "Solo/Tandem",
            (AppLocale::Cz, "RANKED_FLEX_SR") => "Flex",
            (AppLocale::En, "RANKED_SOLO_5x5") => "Solo/Duo",
            (AppLocale::En, "RANKED_FLEX_SR") => "Flex",
            (_, _) => "Ranked Queue",
        }
    }

    pub fn tier_label(&self, tier: &str) -> String {
        let tier_upper = tier.to_ascii_uppercase();
        match self {
            AppLocale::Cz => match tier_upper.as_str() {
                "IRON" => "Železná".to_string(),
                "BRONZE" => "Bronzová".to_string(),
                "SILVER" => "Stříbrná".to_string(),
                "GOLD" => "Zlatá".to_string(),
                "PLATINUM" => "Platinová".to_string(),
                "EMERALD" => "Smaragdová".to_string(),
                "DIAMOND" => "Diamantová".to_string(),
                "MASTER" => "Mistrovská".to_string(),
                "GRANDMASTER" => "Velmistrovská".to_string(),
                "CHALLENGER" => "Vyzyvatelská".to_string(),
                _ => tier_upper,
            },
            AppLocale::En => first_upper(&tier_upper),
        }
    }

    pub fn wins_prefix(&self) -> &'static str {
        match self {
            AppLocale::Cz => "Výhry",
            AppLocale::En => "Wins",
        }
    }

    pub fn losses_prefix(&self) -> &'static str {
        match self {
            AppLocale::Cz => "Prohry",
            AppLocale::En => "Losses",
        }
    }

    pub fn region<'a>(&self, region: &'a str) -> &'a str {
        match region {
            "EUN1" => "EUNE",
            "EUW1" => "EUW",
            "NA1" => "NA",
            "KR" => "KR",
            "BR1" => "BR",
            "LA1" => "LAN",
            "LA2" => "LAS",
            "OC1" => "OCE",
            "RU" => "RU",
            "TR1" => "TR",
            "JP1" => "JP",
            "SG2" => "SEA",
            "TW2" => "TW",
            "VN2" => "VN",
            "ME1" => "ME",
            _ => region,
        }
    }

    pub fn outcome(&self, win: bool) -> &'static str {
        match self {
            AppLocale::Cz => {
                if win {
                    "Výhra"
                } else {
                    "Prohra"
                }
            }
            AppLocale::En => {
                if win {
                    "Win"
                } else {
                    "Loss"
                }
            }
        }
    }

    pub fn team(&self) -> String {
        match self {
            AppLocale::Cz => "Tým".to_string(),
            AppLocale::En => "Team".to_string(),
        }
    }

    pub fn place(&self) -> String {
        match self {
            AppLocale::Cz => "místo".to_string(),
            AppLocale::En => "place".to_string(),
        }
    }

    pub fn lane(&self, lane: &str) -> String {
        match self {
            AppLocale::Cz => match lane {
                "TOP" => "Horní".to_string(),
                "JUNGLE" => "Džungle".to_string(),
                "MIDDLE" => "Středová".to_string(),
                "BOTTOM" => "Spodní".to_string(),
                "UTILITY" => "Podpora".to_string(),
                "FILL" => "Výplň".to_string(),
                _ => lane.to_string(),
            },
            AppLocale::En => match lane {
                "TOP" => "Top".to_string(),
                "JUNGLE" => "Jungle".to_string(),
                "MIDDLE" => "Mid".to_string(),
                "BOTTOM" => "Bot".to_string(),
                "UTILITY" => "Support".to_string(),
                "FILL" => "Fill".to_string(),
                _ => lane.to_string(),
            },
        }
    }

    pub fn loading_game(&self) -> &'static str {
        match self {
            AppLocale::Cz => "Načítání hry",
            AppLocale::En => "Loading game",
        }
    }

    pub fn tier_change_label(&self, is_promotion: bool) -> &'static str {
        match (self, is_promotion) {
            (AppLocale::Cz, true) => "Povýšení do",
            (AppLocale::Cz, false) => "Sestup do",
            (AppLocale::En, true) => "Rank Up to",
            (AppLocale::En, false) => "Rank Down to",
        }
    }

    pub fn unranked(&self) -> &'static str {
        match self {
            AppLocale::Cz => "Nehodnocený",
            AppLocale::En => "Unranked",
        }
    }
}

