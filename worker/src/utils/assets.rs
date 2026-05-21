use std::{env::current_dir, path::PathBuf};

use crate::{tasks::error::TaskResult, utils::get_cache_folder};

pub enum OnlineAsset {
    CommunityDragon,
}

pub enum AssetType {
    Banner,
    Crest,
    DDragon,
    Lanes,
    Mastery,
    Other,
    Ranks,
    Online(OnlineAsset),
}

fn get_online_asset_url(name: &str, asset: &OnlineAsset) -> String {
    match asset {
        OnlineAsset::CommunityDragon => format!("https://raw.communitydragon.org/latest/{}", name),
    }
}

fn get_online_asset_path(name: &str, asset: &OnlineAsset) -> PathBuf {
    let prefix = match asset {
        OnlineAsset::CommunityDragon => "cddragon",
    };

    get_cache_folder().join(format!("{}/{}", prefix, name))
}

async fn fetch_online_asset(name: &str, asset: &OnlineAsset) -> TaskResult<Vec<u8>> {
    let url = get_online_asset_url(name, asset);
    let response = reqwest::get(&url).await?;
    let body = response.bytes().await?;
    Ok(body.to_vec())
}

async fn get_online_asset(name: &str, asset: &OnlineAsset) -> TaskResult<PathBuf> {
    let path = get_online_asset_path(name, asset);
    if path.exists() {
        return Ok(path);
    }

    let data = fetch_online_asset(name, asset).await?;
    tokio::fs::write(&path, data).await?;
    Ok(path)
}

async fn asset_path(asset: &Asset) -> TaskResult<PathBuf> {
    let asset = match &asset.asset_type {
        AssetType::Banner => format!("../assets/banners/{}.png", asset.name),
        AssetType::Crest => format!("../assets/crests/{}.png", asset.name),
        AssetType::DDragon => format!("../assets/ddragon/{}.png", asset.name),
        AssetType::Lanes => format!("../assets/lanes/{}.png", asset.name),
        AssetType::Mastery => format!("../assets/masteries/{}.png", asset.name),
        AssetType::Other => format!("../assets/other/{}.png", asset.name),
        AssetType::Ranks => format!("../assets/ranks/{}.png", asset.name),
        AssetType::Online(online_asset) => {
            return Ok(get_online_asset(&asset.name, &online_asset).await?);
        }
    };

    Ok(current_dir()?.join(asset))
}

pub struct Asset {
    pub asset_type: AssetType,
    pub name: String,
}

impl Asset {
    pub fn new(asset_type: AssetType, name: impl Into<String>) -> Self {
        Self {
            asset_type,
            name: name.into(),
        }
    }
}
