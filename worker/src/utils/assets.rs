use std::path::PathBuf;

use crate::{
    tasks::error::TaskResult,
    utils::{get_cache_folder, rank::Tier},
};

#[derive(Debug, Clone)]
pub enum OnlineAsset {
    CommunityDragon,
}

#[derive(Debug, Clone)]
pub enum AssetType {
    Crest,
    DDragon,
    Lanes,
    Mastery,
    Fonts,
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
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&path, data).await?;
    Ok(path)
}

pub async fn asset_path(asset: &Asset) -> TaskResult<PathBuf> {
    let asset = match &asset.asset_type {
        AssetType::Crest => format!("../assets/crests/{}", asset.name),
        AssetType::DDragon => format!("../assets/ddragon/{}", asset.name),
        AssetType::Lanes => format!("../assets/lanes/{}", asset.name),
        AssetType::Mastery => format!("../assets/masteries/{}", asset.name),
        AssetType::Other => format!("../assets/other/{}", asset.name),
        AssetType::Ranks => format!("../assets/ranks/{}", asset.name),
        AssetType::Online(online_asset) => {
            return Ok(get_online_asset(&asset.name, &online_asset).await?);
        }
        AssetType::Fonts => format!("assets/fonts/{}", asset.name),
    };

    Ok(get_current_dir().join(asset))
}

pub fn get_background_asset() -> Asset {
    Asset::new(AssetType::Other, "background.png")
}

pub async fn get_profile_icon(id: u32) -> TaskResult<Asset> {
    let asset = Asset::new(
        AssetType::DDragon,
        format!("_ROOT_/img/profileicon/{}.png", id),
    );

    if !asset.exists().await? {
        //ID 29 => fallback icon
        Ok(Asset::new(
            AssetType::DDragon,
            "_ROOT_/img/profileicon/29.png",
        ))
    } else {
        Ok(asset)
    }
}

pub fn get_rank_asset(rank: &Tier) -> Asset {
    let name = match rank {
        Tier::Challenger => "Challenger.png",
        Tier::Grandmaster => "Grandmaster.png",
        Tier::Master => "Master.png",
        Tier::Diamond => "Diamond.png",
        Tier::Emerald => "Emerald.png",
        Tier::Platinum => "Platinum.png",
        Tier::Gold => "Gold.png",
        Tier::Silver => "Silver.png",
        Tier::Bronze => "Bronze.png",
        Tier::Iron => "Iron.png",
    };

    // assets/ranks/Ranked Emblems Latest/Rank=%.png
    Asset::new(
        AssetType::Ranks,
        format!("Ranked Emblems Latest/Rank={}", name),
    )
}

#[derive(Debug, Clone)]
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

    pub async fn exists(&self) -> TaskResult<bool> {
        let path = asset_path(self).await?;
        Ok(path.exists())
    }
}
