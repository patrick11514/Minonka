use futures::{StreamExt, stream};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::cache::ddragon::DdragonCache;
use crate::cache::json::JsonCache;
use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection, JustifyContent};
use crate::draw::label::{Alignment, Label};
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::draw::stack::Stack;
use crate::tasks::task::SaveStrategy;
use crate::tasks::types::ProfileParametersInput;
use crate::tasks::{
    error::{TaskError, TaskResult, TaskResultExt},
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, WorkerJob},
};
use crate::utils::assets::{
    Asset, AssetType, OnlineAsset, get_lossstreak_asset, get_online_asset_path, get_profile_icon,
    get_winstreak_asset,
};
use crate::utils::locale::AppLocale;
use crate::utils::rank::{RankTier, Tier};
use tracing::{debug, warn};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SummonerChallengeInput {
    pub challenge_id: i64,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub enum BannerType {
    Default(u32),
    Ranked,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct StreakInput {
    pub r#type: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SummonerTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    #[serde(flatten)]
    pub profile: ProfileParametersInput,
    pub title_id: Option<String>,
    pub crest: u32,
    pub prestige_crest: u32,
    pub banner: BannerType,
    pub highest_rank: Option<RankTier>,
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub streak: Option<StreakInput>,
    pub challenges: Vec<i64>,
    pub user_challenges: Vec<SummonerChallengeInput>,
}

#[derive(Deserialize)]
struct Banner {
    pub name: String,
}

const DEFAULT_BANNER: &str = "00_unranked_banner.png";
const BANNERS_DIR: &str = "game/assets/loadouts/regalia/banners";

fn banner_asset(banner: &str) -> Asset {
    Asset::new(
        AssetType::Online(OnlineAsset::CommunityDragon),
        format!("/{}/{}", BANNERS_DIR, banner),
    )
}

async fn load_cached_banners_from_dir(dir: &std::path::Path) -> Vec<Banner> {
    let mut entries = match tokio::fs::read_dir(dir).await {
        Ok(entries) => entries,
        Err(_) => return Vec::new(),
    };

    let mut banners = Vec::new();
    while let Ok(Some(entry)) = entries.next_entry().await {
        let Ok(metadata) = entry.metadata().await else {
            continue;
        };
        if !metadata.is_file() || metadata.len() == 0 {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if name.ends_with(".png") {
            banners.push(Banner { name });
        }
    }

    banners.sort_by(|a, b| a.name.cmp(&b.name));
    banners
}

async fn resolve_banner_name(
    ddragon_cache: &DdragonCache,
    banner: BannerType,
    highest_rank: Option<RankTier>,
    game_name: &str,
) -> TaskResult<String> {
    match ddragon_cache
        .get::<Vec<Banner>>("/json/latest/game/assets/loadouts/regalia/banners/")
        .await
    {
        Ok(Some(banners)) => find_banner_name(&banners, banner, highest_rank)
            .context("resolve summoner banner", game_name.to_string()),
        Ok(None) => Ok(DEFAULT_BANNER.to_string()),
        Err(err) => {
            warn!(
                error = %err,
                "Failed to fetch summoner banners from CommunityDragon, falling back to cached banners"
            );
            let cached_dir = get_online_asset_path(BANNERS_DIR, &OnlineAsset::CommunityDragon);
            let cached_banners = load_cached_banners_from_dir(&cached_dir).await;
            find_banner_name(&cached_banners, banner, highest_rank)
                .context("resolve cached summoner banner", game_name.to_string())
        }
    }
}

async fn load_summoner_background(banner: &str, context: &AppContext) -> MasterCanvas {
    match MasterCanvas::from_asset(banner_asset(banner), context.clone().into()).await {
        Ok(canvas) => canvas,
        Err(err) => {
            warn!(
                banner = %banner,
                error = %err,
                "Failed to load summoner banner, falling back to default banner"
            );
            if banner != DEFAULT_BANNER {
                match MasterCanvas::from_asset(banner_asset(DEFAULT_BANNER), context.clone().into())
                    .await
                {
                    Ok(canvas) => return canvas,
                    Err(default_err) => {
                        warn!(
                            banner = DEFAULT_BANNER,
                            error = %default_err,
                            "Failed to load default summoner banner, using solid fallback canvas"
                        );
                    }
                }
            }

            MasterCanvas::new(
                image::RgbaImage::from_pixel(512, 512, image::Rgba([20, 24, 34, 255])),
                context.clone().into(),
            )
        }
    }
}

fn find_banner_name(
    banners: &[Banner],
    banner: BannerType,
    highest_rank: Option<RankTier>,
) -> TaskResult<String> {
    match banner {
        BannerType::Default(id) => {
            // Quick note on banner ids:
            // - 1 this is default banner => 00_unranked_banner.png
            // - 2 this is ranked banner => should be handled by frontend, and went inside BannerType::Ranked, so we can ignore it here
            // - 3..9 needs specific case of ignoring the silver, gold, platinum, diamond, master, grandmaster, challenger banners, which are 03_silver_banner.png, 04_gold_banner.png, 05_platinum_banner.png, 06_diamond_banner.png, 07_master_banner.png, 08_grandmaster_banner.png, 09_challenger_banner.png
            // and we want to match the correct banners like: 03_lny23_banner.png or 04_sf23_banner.png...
            // ...
            // ids > 10 should be matched correctly
            if id == 2 {
                return Err(TaskError::Runtime(
                    "Id 2 is reserved for Ranked banner and should be handled by frontend"
                        .to_string(),
                ));
            }

            let prefix = if id == 1 {
                "00".to_string() // For some reason, the default banner with id 1 is named "00_unranked_banner.png"
            } else if id < 10 {
                format!("0{id}")
            } else {
                id.to_string()
            };

            let banner = banners.iter().find(
                |banner| {
                    banner.name.starts_with(&prefix)
                        && !matches!(
                            banner.name.as_str(),
                            "03_silver_banner.png"
                                | "04_gold_banner.png"
                                | "05_platinum_banner.png"
                                | "06_diamond_banner.png"
                                | "07_master_banner.png"
                                | "08_grandmaster_banner.png"
                                | "09_challenger_banner.png"
                        )
                }, /* Silver banner is 03_silver, so for id 03 it could be matched */
            );

            Ok(banner.map_or(DEFAULT_BANNER.to_string(), |b| b.name.clone()))
        }
        BannerType::Ranked => {
            let Some(rank_tier) = highest_rank else {
                return Ok(DEFAULT_BANNER.to_string());
            };

            let banner = banners.iter().find(|banner| {
                banner
                    .name
                    .contains(&format!("{}_banner", rank_tier.tier().as_lowercase_str()))
            });
            Ok(banner.map_or(DEFAULT_BANNER.to_string(), |b| b.name.clone()))
        }
    }
}

pub struct SummonerTask;

impl Task for SummonerTask {
    type Input = SummonerTaskInput;

    const NAME: &'static str = "summoner";
    const JOB: WorkerJob = WorkerJob::Summoner;

    #[tracing::instrument(skip(input, context), fields(task = Self::NAME), err)]
    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let locale = AppLocale::from_str(&input.default.locale);
        let ddragon_cache: DdragonCache = context.clone().into();
        let json: JsonCache = context.clone().into();

        let banner = resolve_banner_name(
            &ddragon_cache,
            input.banner,
            input.highest_rank.clone(),
            &input.profile.game_name,
        )
        .await?;

        debug!(banner = %banner, "selected summoner banner");

        let level_background = Asset::new(AssetType::Other, "level.png");
        let mut level_background = Sprite::from_asset(&level_background, 0, 0).await?;
        level_background.resize_to_width(66);
        let center_of_level_background = level_background.dimensions().0 / 2;
        debug!(
            center_of_level_background,
            "prepared summoner level background"
        );

        let profile_icon = get_profile_icon(input.profile.profile_icon_id).await?;
        let mut profile_icon = Sprite::from_asset(&profile_icon, 0, 0).await?;
        profile_icon.roundify_circle();
        profile_icon.resize_to_width(100);

        let profile_icon_size = profile_icon.dimensions();
        let mut ranked_crest = false;

        let crest = Asset::new(
            AssetType::Crest,
            if input.crest == 2 || input.crest == 1 && input.prestige_crest == 0 {
                //Ranked one
                ranked_crest = true;
                format!(
                    "{}_base.png",
                    input
                        .highest_rank
                        .as_ref()
                        .map(|rank| rank.tier().as_lowercase_str().to_string())
                        .expect("User doesn't have a rank, but has ranked crest")
                )
            } else {
                //pad number to 3 digits, so 1 becomes 001, 2 becomes 002, etc...
                format!("prestige_crest_lvl_{:03}.png", input.prestige_crest)
            },
        );
        debug!(crest = %crest.name, "selected summoner crest");
        let mut crest = Sprite::from_asset(&crest, 0, 0).await?;

        if !ranked_crest {
            crest.resize_to_width(240);
        } else {
            crest.resize_to_width(420);
        }

        //if one challange is selected, other places is filledw ith -1
        if !(input.challenges.len() == 3 || input.challenges.is_empty()) {
            return Err(TaskError::Runtime(format!(
                "There should be either 0 or 3 challenges, but got {}",
                input.challenges.len()
            )));
        }

        let challenges = input.challenges.iter().map(|challenge_id| {
            let challenge = input
                .user_challenges
                .iter()
                .find(|c| c.challenge_id == *challenge_id);
            if let Some(challenge) = challenge {
                Some(format!("{}-{}.png", challenge_id, challenge.level))
            } else {
                None
            }
        });

        let challenge_size = 50;

        let challenges: Vec<Option<Sprite>> = stream::iter(challenges)
            .then(async |challenge| match challenge {
                Some(path) => {
                    let asset = Asset::new(
                        AssetType::DDragon,
                        format!("/img/challenges-images/{}", path),
                    );
                    let mut sprite = Sprite::from_asset(&asset, 0, 0)
                        .await
                        .context("load summoner challenge sprite", path)
                        .ok()?;

                    sprite.resize_to_width(challenge_size);

                    Some(sprite)
                }
                None => None,
            })
            .collect()
            .await;

        let challenges_json = json
            .get_challenges(&locale)
            .await?
            .expect("challenges json should be available");

        let title = input.title_id.and_then(|id_idx| {
            if id_idx.len() < 7 {
                return None;
            }

            //012345|67
            //id    | idx in the object
            let id = &id_idx[0..6].parse::<u32>().unwrap_or(0);
            let idx = &id_idx[6..].parse::<usize>().unwrap_or(0);

            challenges_json
                .iter()
                .find(|c| c.id == *id)
                .and_then(|challenge| challenge.thresholds.get_index(*idx))
                .and_then(|(_, threshold)| threshold.rewards.as_ref())
                .and_then(|rewards| {
                    rewards
                        .iter()
                        .find(|reward| reward.title.is_some())
                        .and_then(|reward| reward.title.clone())
                })
        });

        let streak_container = if let Some(streak) = &input.streak {
            let is_win = streak.r#type == "win";
            let asset = if is_win {
                get_winstreak_asset()
            } else {
                get_lossstreak_asset()
            };

            if let Ok(mut icon) = Sprite::from_asset(&asset, 0, 0).await {
                icon.resize_to_width(32);
                let text = format!("{}{}", if is_win { "W" } else { "L" }, streak.count);
                let color = if is_win {
                    Color::Rgba(255, 153, 0, 255)
                } else {
                    Color::Rgba(51, 153, 255, 255)
                };

                Some(
                    Container::new()
                        .direction(ContainerDirection::Row)
                        .gap(6)
                        .align_items(AlignItems::Center)
                        .child(icon)
                        .child(Label::new(text).bold().size(22).color(color)),
                )
            } else {
                None
            }
        } else {
            None
        };

        let canvas = load_summoner_background(&banner, &context)
            .await
            .with_layout(|root| {
                root.direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .gap(35)
                    .child(
                        Container::new()
                            .align_items(AlignItems::Center)
                            .y(20)
                            .child(
                                Label::new(locale.region(&input.default.region))
                                    .bold()
                                    .size(24),
                            ),
                    )
                    .child(
                        Stack::new().child(level_background).child(
                            Label::new(input.profile.level.to_string())
                                .bold()
                                .size(24)
                                .x(center_of_level_background as i32)
                                .align(Alignment::Middle),
                        ),
                    )
                    .child(
                        Stack::new()
                            .size(profile_icon.dimensions())
                            .align_center()
                            .child(profile_icon.y(if ranked_crest { 0 } else { 6 }))
                            .child(crest)
                            .child_if(
                                if ranked_crest
                                    && input.highest_rank.clone().unwrap().tier() < &Tier::Master
                                {
                                    Some(
                                        Container::new()
                                            .size(profile_icon_size)
                                            .justify(JustifyContent::Center)
                                            .child(
                                                Label::new(
                                                    input.highest_rank.unwrap().rank().as_str(),
                                                )
                                                .bold()
                                                .size(20)
                                                .y(-7),
                                            ),
                                    )
                                } else {
                                    None
                                },
                            ),
                    )
                    .child(
                        Container::new()
                            .y(10)
                            .direction(ContainerDirection::Column)
                            .align_items(AlignItems::Center)
                            .child(
                                Label::new(format!(
                                    "{}#{}",
                                    input.profile.game_name, input.profile.tag_line
                                ))
                                .bold()
                                .size(24),
                            )
                            .child_if(title.map(|t| Label::new(t).size(20).color(Color::Gray))),
                    )
                    .child_if(streak_container)
                    .child(
                        Container::new()
                            .direction(ContainerDirection::Row)
                            .gap(10)
                            .align_items(AlignItems::Center)
                            .childs(challenges.into_iter().map(|challenge| {
                                Stack::new()
                                    .size((challenge_size, challenge_size))
                                    .child_if(challenge)
                            })),
                    )
            });

        Ok(TaskOutcome::Render(canvas, SaveStrategy::Temporary))
    }
}

mod test {
    #[tokio::test]
    async fn test_summoner_empty() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_empty.json");
    }

    #[tokio::test]
    async fn test_summoner_crest() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_crest.json");
    }

    #[tokio::test]
    async fn test_summoner_crest_2() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_crest_2.json");
    }

    #[tokio::test]
    async fn test_summoner_light() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_light.json");
    }

    #[tokio::test]
    async fn test_summoner_light_2() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_light_2.json");
    }

    #[tokio::test]
    async fn test_summoner_rich() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_rich.json");
    }

    #[tokio::test]
    async fn test_summoner_rich_2() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_rich_2.json");
    }

    #[tokio::test]
    async fn test_summoner_edge() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_edge.json");
    }

    #[tokio::test]
    async fn test_summoner_start() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_start.json");
    }

    #[tokio::test]
    async fn test_summoner_middle() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_middle.json");
    }

    #[tokio::test]
    async fn test_summoner_end() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_end.json");
    }

    #[tokio::test]
    async fn test_load_cached_banners_from_dir_filters_and_sorts() {
        let dir = std::env::temp_dir().join(format!(
            "minonka-banners-test-{}",
            crate::utils::unique_id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("13_welcome_to_noxus_banner.png"), b"png").unwrap();
        std::fs::write(dir.join("00_unranked_banner.png"), b"png").unwrap();
        std::fs::write(dir.join("empty.png"), b"").unwrap();
        std::fs::write(dir.join("00_unranked_banner.tmp-123"), b"tmp").unwrap();

        let banners = super::load_cached_banners_from_dir(&dir).await;
        let names: Vec<String> = banners.into_iter().map(|b| b.name).collect();
        assert_eq!(
            names,
            vec![
                "00_unranked_banner.png".to_string(),
                "13_welcome_to_noxus_banner.png".to_string(),
            ]
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn test_resolve_banner_name_falls_back_on_upstream_error() {
        let cache_dir = std::env::temp_dir().join(format!(
            "minonka-banner-fallback-{}",
            crate::utils::unique_id()
        ));
        // Port 1 refuses connections immediately; no disk cache exists in cache_dir.
        let ddragon_cache =
            crate::cache::ddragon::DdragonCache::with_config("http://127.0.0.1:1", Some(cache_dir.clone()));

        let banner = super::resolve_banner_name(
            &ddragon_cache,
            super::BannerType::Default(99999),
            None,
            "TestPlayer",
        )
        .await
        .unwrap();

        assert_eq!(banner, super::DEFAULT_BANNER);

        let _ = std::fs::remove_dir_all(&cache_dir);
    }
}
