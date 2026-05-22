use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tokio::fs;

use crate::tasks::error::TaskResult;

pub mod assets;
pub mod locale;
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
