use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tokio::fs;
use tracing_subscriber::{EnvFilter, fmt::format::FmtSpan};

use crate::{
    draw::{color::Color, label::Label},
    tasks::error::TaskResult,
    utils::locale::AppLocale,
};

pub mod assets;
pub mod locale;
pub mod rank;
pub mod storage;
pub mod test;

pub fn get_cache_folder() -> PathBuf {
    std::env::var("CACHE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}

pub fn get_persistent_cache_folder() -> PathBuf {
    std::env::var("PERSISTANT_CACHE_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("cache"))
}

pub async fn ensure_dir(path: &Path) -> TaskResult<()> {
    if !path.exists() {
        fs::create_dir_all(path).await?;
    }
    Ok(())
}

pub fn get_current_dir() -> PathBuf {
    std::env::current_dir().unwrap().join("..")
}

pub fn unique_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    format!("{:x}-{:x}", nanos, std::process::id())
}

pub fn first_upper(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    let lower = value.to_ascii_lowercase();
    let mut chars = lower.chars();
    let first = chars.next().unwrap_or_default().to_ascii_uppercase();
    format!("{first}{}", chars.collect::<String>())
}

pub fn rank_color(tier: &str) -> Color {
    match tier {
        "CHALLENGER" => Color::from_hex("#E8CD7F"),
        "GRANDMASTER" => Color::from_hex("#D34C5C"),
        "MASTER" => Color::from_hex("#9F5FE0"),
        "DIAMOND" => Color::from_hex("#58B9E8"),
        "EMERALD" => Color::from_hex("#4CCF9A"),
        "PLATINUM" => Color::from_hex("#42B7AA"),
        "GOLD" => Color::from_hex("#D9B14A"),
        "SILVER" => Color::from_hex("#BDC3C7"),
        "BRONZE" => Color::from_hex("#B27A50"),
        "IRON" => Color::from_hex("#9A8F8F"),
        _ => Color::White,
    }
}

pub fn rank_to_label(tier: &str, rank: &str, locale: &AppLocale) -> Label {
    Label::new(if matches!(tier, "MASTER" | "GRANDMASTER" | "CHALLENGER") {
        locale.tier_label(tier)
    } else {
        format!("{} {}", locale.tier_label(tier), rank)
    })
    .color(rank_color(tier))
}

pub fn init_tracing() {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_span_events(FmtSpan::NEW | FmtSpan::CLOSE)
        .try_init();
}
