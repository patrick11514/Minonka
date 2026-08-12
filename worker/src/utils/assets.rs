use std::{fmt::Display, path::PathBuf};

use crate::{
    cache::json::JsonCache,
    tasks::error::{TaskError, TaskResult, TaskResultExt},
    utils::{get_current_dir, get_persistent_cache_folder, locale::AppLocale, rank::Tier},
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

impl Display for AssetType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AssetType::Crest => write!(f, "Crest"),
            AssetType::DDragon => write!(f, "DDragon"),
            AssetType::Lanes => write!(f, "Lanes"),
            AssetType::Mastery => write!(f, "Mastery"),
            AssetType::Other => write!(f, "Other"),
            AssetType::Ranks => write!(f, "Ranks"),
            AssetType::Online(online_asset) => match online_asset {
                OnlineAsset::CommunityDragon => write!(f, "Online(CommunityDragon)"),
            },
            AssetType::Fonts => write!(f, "Fonts"),
        }
    }
}

#[tracing::instrument(skip(asset), fields(asset = %name, asset_type = ?asset))]
fn get_online_asset_url(name: &str, asset: &OnlineAsset) -> String {
    let clean_name = name.strip_prefix('/').unwrap_or(name);
    match asset {
        OnlineAsset::CommunityDragon => {
            format!("https://raw.communitydragon.org/latest/{}", clean_name)
        }
    }
}

#[tracing::instrument(skip(asset), fields(asset = %name, asset_type = ?asset))]
fn get_online_asset_path(name: &str, asset: &OnlineAsset) -> PathBuf {
    let prefix = match asset {
        OnlineAsset::CommunityDragon => "cddragon",
    };
    let clean_name = name.strip_prefix('/').unwrap_or(name);

    get_current_dir()
        .join(get_persistent_cache_folder())
        .join(format!("{}/{}", prefix, clean_name))
}

#[tracing::instrument(skip(asset), fields(asset = %name, asset_type = ?asset), err)]
async fn fetch_online_asset(name: &str, asset: &OnlineAsset) -> TaskResult<Vec<u8>> {
    let url = get_online_asset_url(name, asset);
    let response = reqwest::get(&url)
        .await
        .map_err(TaskError::Reqwest)
        .context("fetch online asset", url.clone())?;
    let response = response
        .error_for_status()
        .map_err(TaskError::Reqwest)
        .context("status check online asset", url.clone())?;
    let body = response
        .bytes()
        .await
        .map_err(TaskError::Reqwest)
        .context("read online asset body", url)?;
    Ok(body.to_vec())
}

#[tracing::instrument(skip(asset), fields(asset = %name, asset_type = ?asset), err)]
async fn get_online_asset(name: &str, asset: &OnlineAsset) -> TaskResult<PathBuf> {
    let path = get_online_asset_path(name, asset);
    if path.exists() {
        if let Ok(metadata) = tokio::fs::metadata(&path).await {
            if metadata.len() > 0 {
                return Ok(path);
            }
        }
    }

    let data = fetch_online_asset(name, asset).await?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(TaskError::Io)
            .context(
                "create online asset cache dir",
                parent.to_string_lossy().to_string(),
            )?;
    }

    let tmp_path = path.with_extension(format!("tmp-{}", crate::utils::unique_id()));
    if let Err(err) = tokio::fs::write(&tmp_path, data).await {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err(TaskError::Io(err).context(
            "write online asset tmp",
            tmp_path.to_string_lossy().to_string(),
        ));
    }

    if let Err(err) = tokio::fs::rename(&tmp_path, &path).await {
        let _ = tokio::fs::remove_file(&tmp_path).await;
        return Err(
            TaskError::Io(err).context("rename online asset", path.to_string_lossy().to_string())
        );
    }

    Ok(path)
}

#[tracing::instrument(skip(asset), fields(asset = %asset.name, asset_type = ?asset.asset_type), err)]
pub async fn asset_path(asset: &Asset) -> TaskResult<PathBuf> {
    let asset = match &asset.asset_type {
        AssetType::Crest => format!("assets/crests/{}", asset.name),
        AssetType::DDragon => format!("assets/ddragon/{}", asset.name),
        AssetType::Lanes => format!("assets/lanes/{}", asset.name),
        AssetType::Mastery => format!("assets/masteries/{}", asset.name),
        AssetType::Other => format!("assets/other/{}", asset.name),
        AssetType::Ranks => format!("assets/ranks/{}", asset.name),
        AssetType::Online(online_asset) => {
            return Ok(get_online_asset(&asset.name, &online_asset)
                .await
                .context("resolve online asset", asset.name.clone())?);
        }
        AssetType::Fonts => format!("assets/fonts/{}", asset.name),
    };

    Ok(get_current_dir().join(asset))
}

pub fn get_background_asset() -> Asset {
    Asset::new(AssetType::Other, "background.png")
}

fn get_fallback_asset() -> Asset {
    Asset::new(
        AssetType::DDragon,
        "_ROOT_/img/profileicon/29.png".to_string(),
    )
}

pub async fn get_profile_icon(id: u32) -> TaskResult<Asset> {
    let asset = Asset::new(
        AssetType::DDragon,
        format!("_ROOT_/img/profileicon/{}.png", id),
    );

    if !asset.exists().await? {
        //ID 29 => fallback icon
        Ok(get_fallback_asset())
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

pub async fn get_champion_asset(
    champion_id: Option<u32>,
    cache: &JsonCache,
    lang: &AppLocale,
) -> TaskResult<Asset> {
    if let Some(id) = champion_id {
        let champion = cache
            .get_champions(lang)
            .await?
            .expect("Failed to load champions");
        let champion_data = champion
            .data
            .iter()
            .find(|(_, data)| data.key == id.to_string())
            .map(|(_, data)| data.image.full.clone());

        if let Some(image) = champion_data {
            return Ok(Asset::new(
                AssetType::DDragon,
                format!("_ROOT_/img/champion/{}", image),
            ));
        }
    }

    // Fallback asset -> profile icon 29
    Ok(get_fallback_asset())
}

pub async fn get_rune_asset(
    style: u32,
    selection: Option<u32>,
    cache: &JsonCache,
    lang: &AppLocale,
) -> TaskResult<Asset> {
    let runes = cache.get_runes(lang).await?.expect("Failed to load runes");

    let style = runes.iter().find(|rune| rune.id == style);

    let key = if let Some(selection) = selection {
        match style
            .and_then(|rune| rune.slots.first())
            .and_then(|slot| slot.runes.iter().find(|r| r.id == selection))
            .and_then(|rune| Some(rune.icon.clone()))
        {
            Some(style) => style,
            None => return Ok(get_fallback_asset()),
        }
    } else {
        match style.and_then(|rune| Some(rune.icon.clone())) {
            Some(style) => style,
            None => return Ok(get_fallback_asset()),
        }
    };

    Ok(Asset::new(AssetType::DDragon, format!("/img/{}", key)))
}

pub async fn get_perk_asset(
    perk_id: u32,
    cache: &JsonCache,
    lang: &AppLocale,
) -> TaskResult<Asset> {
    // Stat shard perks mapping (ddragon or online asset)
    let stat_perk_icon = match perk_id {
        5001 => Some("perk-images/StatMods/StatModsHealthScalingIcon.png"),
        5002 => Some("perk-images/StatMods/StatModsArmorIcon.png"),
        5003 => Some("perk-images/StatMods/StatModsMagicRes.png"),
        5005 => Some("perk-images/StatMods/StatModsAttackSpeedIcon.png"),
        5007 => Some("perk-images/StatMods/StatModsCDRScalingIcon.png"),
        5008 => Some("perk-images/StatMods/StatModsAdaptiveForceIcon.png"),
        5010 => Some("perk-images/StatMods/StatModsMovementSpeedIcon.png"),
        5011 => Some("perk-images/StatMods/StatModsHealthPlusIcon.png"),
        5013 => Some("perk-images/StatMods/StatModsTenacityIcon.png"),
        _ => None,
    };

    if let Some(icon) = stat_perk_icon {
        return Ok(Asset::new(AssetType::DDragon, format!("/img/{}", icon)));
    }

    let runes = cache.get_runes(lang).await?.expect("Failed to load runes");

    for tree in &runes {
        if tree.id == perk_id {
            return Ok(Asset::new(AssetType::DDragon, format!("/img/{}", tree.icon)));
        }
        for slot in &tree.slots {
            for rune in &slot.runes {
                if rune.id == perk_id {
                    return Ok(Asset::new(AssetType::DDragon, format!("/img/{}", rune.icon)));
                }
            }
        }
    }

    Ok(get_fallback_asset())
}

pub fn get_item_asset(id: u32) -> Asset {
    Asset::new(AssetType::DDragon, format!("_ROOT_/img/item/{}.png", id))
}

pub async fn get_summoner_asset(id: u32, cache: &JsonCache, lang: &AppLocale) -> TaskResult<Asset> {
    let summoners = cache
        .get_summoner_spells(lang)
        .await?
        .expect("Failed to load summoner spells");

    let summoner = summoners
        .data
        .iter()
        .find(|(_, data)| data.key == id.to_string())
        .map(|(_, data)| data.image.full.clone())
        .expect("Summoner spell not found");

    Ok(Asset::new(
        AssetType::DDragon,
        format!("_ROOT_/img/spell/{}", summoner),
    ))
}

pub enum Stat {
    Minions,
    Damage,
    Golds,
}

pub fn get_stat_asset(stat: &Stat) -> Asset {
    let name = match stat {
        Stat::Minions => "minion.png",
        Stat::Damage => "sword.png",
        Stat::Golds => "coins.png",
    };

    Asset::new(AssetType::Other, name)
}

pub fn get_team_asset() -> Asset {
    Asset::new(AssetType::Other, "team.png")
}

pub fn get_winstreak_asset() -> Asset {
    Asset::new(AssetType::Other, "winstreak.png")
}

pub fn get_lossstreak_asset() -> Asset {
    Asset::new(AssetType::Other, "lossstreak.png")
}


pub fn get_rooster_asset(id: u32) -> Asset {
    Asset::new(
        AssetType::Online(OnlineAsset::CommunityDragon),
        format!("/game/assets/clash/roster-logos/{}/1_64.png", id),
    )
}

#[derive(Debug, Clone)]
pub struct Asset {
    pub asset_type: AssetType,
    pub name: String,
}

impl Display for Asset {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}:{}", self.asset_type, self.name)
    }
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
