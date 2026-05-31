use futures::{StreamExt, stream};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::cache::ddragon::DdragonCache;
use crate::cache::json::JsonCache;
use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection};
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
use crate::utils::assets::{Asset, AssetType, OnlineAsset, get_profile_icon};
use crate::utils::locale::AppLocale;
use crate::utils::rank::RankTier;
use tracing::debug;

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
    pub challenges: Vec<i64>,
    pub user_challenges: Vec<SummonerChallengeInput>,
}

#[derive(Deserialize)]
struct Banner {
    pub name: String,
}

const DEFAULT_BANNER: &str = "00_unranked_banner.png";

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

        let banners = ddragon_cache
            .get::<Vec<Banner>>("/json/latest/game/assets/loadouts/regalia/banners/")
            .await?;

        let banner = match banners {
            Some(banners) => find_banner_name(&banners, input.banner, input.highest_rank.clone())
                .context("resolve summoner banner", input.profile.game_name.clone())?,
            None => DEFAULT_BANNER.to_string(),
        };

        debug!(banner = %banner, "selected summoner banner");

        let background = Asset::new(
            AssetType::Online(OnlineAsset::CommunityDragon),
            format!("/game/assets/loadouts/regalia/banners/{}", banner),
        );

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
                        .unwrap_or_else(|| "iron".to_string())
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

        let canvas = MasterCanvas::from_asset(background, context.into())
            .await
            .context(
                "load summoner background canvas",
                locale.region(&input.default.region),
            )?
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
                            .child(crest),
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
}
