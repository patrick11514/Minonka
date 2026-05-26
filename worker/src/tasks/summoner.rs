use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, WorkerJob},
};
use crate::utils::assets::{Asset, AssetType, OnlineAsset, get_profile_icon};
use crate::utils::ddragon_cache::DdragonCache;
use crate::utils::locale::AppLocale;
use crate::utils::rank::RankTier;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SummonerChallengeInput {
    pub challenge_id: u64,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SummonerTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub title_id: Option<String>,
    pub crest: u32,
    pub prestige_crest: u32,
    pub banner: u32,
    pub challenges: Vec<u64>,
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
) -> String {
    match banner {
        BannerType::Default(id) => {
            // Quick note on banner ids:
            // - 1 this is default banner => 00_unranked_banner.png
            // - 2 this is ranked banner => should be handled by frontend, and went inside BannerType::Ranked, so we can ignore it here
            // - 3..9 needs specific case of ignoring the silver, gold, platinum, diamond, master, grandmaster, challenger banners, which are 03_silver_banner.png, 04_gold_banner.png, 05_platinum_banner.png, 06_diamond_banner.png, 07_master_banner.png, 08_grandmaster_banner.png, 09_challenger_banner.png
            // and we want to match the correct banners like: 03_lny23_banner.png or 04_sf23_banner.png...
            // ...
            // ids > 10 should be matched correctly
            assert!(
                id != 2,
                "Id 2 is reserved for Ranked banner, which should be correctly handled by frontend."
            );

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

            banner.map_or(DEFAULT_BANNER.to_string(), |b| b.name.clone())
        }
        BannerType::Ranked => {
            let Some(rank_tier) = highest_rank else {
                return DEFAULT_BANNER.to_string();
            };

            let banner = banners.iter().find(|banner| {
                banner
                    .name
                    .contains(&format!("{}_banner", rank_tier.tier().as_lowercase_str()))
            });
            banner.map_or(DEFAULT_BANNER.to_string(), |b| b.name.clone())
        }
    }
}

pub struct SummonerTask;

impl Task for SummonerTask {
    type Input = SummonerTaskInput;

    const NAME: &'static str = "summoner";
    const JOB: WorkerJob = WorkerJob::Summoner;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let _locale = AppLocale::from_str(&input.default.locale);
        let ddragon_cache: DdragonCache = context.clone().into();

        let banners = ddragon_cache
            .get::<Vec<Banner>>("/json/latest/game/assets/loadouts/regalia/banners/")
            .await?;

        let banner = match banners {
            Some(banners) => find_banner_name(&banners, input.banner, input.highest_rank.clone()),
            None => DEFAULT_BANNER.to_string(),
        };

        let background = Asset::new(
            AssetType::Online(OnlineAsset::CommunityDragon),
            format!("/game/assets/loadouts/regalia/banners/{}", banner),
        );

        let level_background = Asset::new(AssetType::Other, "level.png");
        let mut level_background = Sprite::from_asset(&level_background, 0, 0).await?;
        level_background.resize_to_width(160);
        let _center_of_level_background = level_background.dimensions().0 / 2;

        let profile_icon = get_profile_icon(input.default.profile_icon_id).await?;
        let _profile_icon = Sprite::from_asset(&profile_icon, 0, 0)
            .await?
            .roundify_circle();

        let crest = Asset::new(
            AssetType::Crest,
            if input.crest == 2 || input.crest == 1 && input.prestige_crest == 0 {
                //Ranked one
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
        let _crest = Sprite::from_asset(&crest, 0, 0).await?;

        //if one challange is selected, other places is filledw ith -1
        assert!(
            input.challenges.len() == 3 || input.challenges.is_empty(),
            "There should be either 0 or 3 challenges, but got {}",
            input.challenges.len()
        );

        let _challenges = input.challenges.iter().map(|challenge_id| {
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

        let canvas = MasterCanvas::from_asset(background, context.into()).await?;

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
    async fn test_summoner_single() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_single.json");
    }

    #[tokio::test]
    async fn test_summoner_edge() {
        crate::assert_task!(super::SummonerTask, "test_files/summoner_edge.json");
    }
}
