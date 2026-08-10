use std::sync::Arc;

use crate::cache::json::JsonCache;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection, JustifyContent};
use crate::draw::label::Label;
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::draw::stack::Stack;
use crate::tasks::task::SaveStrategy;
use crate::tasks::types::DefaultParametersInput;
use crate::utils::assets::{
    Asset, AssetType, Stat, get_background_asset, get_champion_asset, get_item_asset,
    get_rank_asset, get_rune_asset, get_stat_asset, get_summoner_asset,
};
use crate::utils::deser::deserialize_ban_id;
use crate::utils::locale::AppLocale;
use crate::utils::rank::{Rank, Tier};
use crate::utils::storage::get_persistent_result;
use crate::utils::{fix_champion_name, format_date, format_duration, format_with_spaces};
use futures::future::{join_all, try_join_all};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{MatchMetadataInput, WorkerJob},
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct TierChangeInput {
    pub is_promotion: bool,
    pub tier: Tier,
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub rank: Option<Rank>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub metadata: MatchMetadataInput,
    pub info: MatchInfoInput,
    pub lp_gain: Option<i32>,
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub tier_change: Option<TierChangeInput>,
    pub queue_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchInfoInput {
    pub game_end_timestamp: i64,
    pub game_duration: u32,
    pub queue_id: u32,
    pub participants: Vec<MatchParticipantInput>,
    pub teams: Vec<MatchTeamInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchTeamInput {
    pub bans: Vec<MatchBanInput>,
    pub team_id: u32,
    pub win: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchBanInput {
    #[serde(deserialize_with = "deserialize_ban_id")]
    pub champion_id: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchParticipantInput {
    pub assists: u32,
    pub champ_level: u32,
    pub champion_name: String,
    pub deaths: u32,
    pub game_ended_in_early_surrender: bool,
    pub gold_earned: u32,
    pub kills: u32,
    pub item0: u32,
    pub item1: u32,
    pub item2: u32,
    pub item3: u32,
    pub item4: u32,
    pub item5: u32,
    pub item6: u32,
    pub puuid: String,
    pub riot_id_game_name: String,
    pub riot_id_tagline: String,
    pub role_bound_item: Option<u32>,
    pub summoner1_id: u32,
    pub summoner2_id: u32,
    pub team_id: u32,
    pub total_damage_dealt_to_champions: u32,
    pub total_minions_killed: u32,
    pub vision_score: u32,
    pub perks: MatchPerksInput,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchPerksInput {
    pub styles: Vec<MatchPerkStyleInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchPerkStyleInput {
    pub selections: Vec<MatchPerkSelectionInput>,
    pub style: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MatchPerkSelectionInput {
    pub perk: u32,
}

#[derive(Clone)]
struct RenderContext {
    pub json: Arc<JsonCache>,
    pub locale: AppLocale,
}

impl RenderContext {
    pub async fn bans(&self, bans: &[MatchBanInput], cross: Sprite) -> Container {
        let childs = bans.into_iter().map(|ban| {
            let cross = cross.clone();
            async move {
                let champion = get_champion_asset(ban.champion_id, &self.json, &self.locale)
                    .await
                    .expect("Failed to get champion asset");
                let mut image = Sprite::from_asset(&champion, 0, 0)
                    .await
                    .expect("Failed to read champion asset");

                image.resize_to_width(cross.dimensions().0);

                Stack::new().child(image).child(cross)
            }
        });

        let childs = join_all(childs).await;

        Container::new()
            .direction(ContainerDirection::Row)
            .gap(10)
            .childs(childs)
    }

    async fn render_stat(&self, stat: Stat, value: u32) -> TaskResult<Container> {
        let asset = get_stat_asset(&stat);
        let mut image = Sprite::from_asset(&asset, 0, 0).await?;
        image.resize_to_width(30);
        Ok(Container::new()
            .gap(4)
            .child(image)
            .child(Label::new(format_with_spaces(value)).bold().size(32)))
    }

    pub async fn player_component(
        &self,
        player: &MatchParticipantInput,
        me: bool,
        reversed: bool,
    ) -> TaskResult<Container> {
        let champion = Asset::new(
            AssetType::DDragon,
            format!(
                "_ROOT_/img/champion/{}.png",
                fix_champion_name(&player.champion_name)
            ),
        );

        let mut champion = Sprite::from_asset(&champion, 0, 0)
            .await
            .expect("Failed to read champion asset");
        champion.resize_to_width(96);

        let champion_dimensions = champion.dimensions();
        let level_text_size = 32;

        let (style, selection) = player
            .perks
            .styles
            .first()
            .and_then(|style| {
                Some((
                    style.style,
                    style
                        .selections
                        .first()
                        .map(|s| s.perk)
                        .expect("No primary rune selected"),
                ))
            })
            .expect("No rune path found");

        let total_height = champion_dimensions.1 + level_text_size / 2;
        let spacing = 5;
        let item_spacing = 4;
        let item_size = total_height - 48;

        let rune = get_rune_asset(style, Some(selection), &self.json, &self.locale).await?;
        let mut rune = Sprite::from_asset(&rune, 0, 0).await?;
        rune.resize_to_width(total_height / 2 - spacing);

        let quest = if let Some(quest_item) = player.role_bound_item {
            get_item_asset(quest_item)
        } else {
            get_rune_asset(
                player
                    .perks
                    .styles
                    .iter()
                    .nth(1)
                    .and_then(|perk| Some(perk.style))
                    .expect("Second perk not found"),
                None,
                &self.json,
                &self.locale,
            )
            .await?
        };

        //Quest on normal Summoners rift and secondary rune on ARAM
        let mut quest_or_secondary_rune = Sprite::from_asset(&quest, 0, 0).await?;
        quest_or_secondary_rune.resize_to_width(
            total_height / 2
                - if let Some(_) = player.role_bound_item {
                    spacing
                } else {
                    spacing * 4
                },
        );

        let rune_dimensions = rune.dimensions();

        let summoner_1 = get_summoner_asset(player.summoner1_id, &self.json, &self.locale).await?;
        let mut summoner_1 = Sprite::from_asset(&summoner_1, 0, 0).await?;
        summoner_1.resize_to_width(total_height / 2 - spacing);

        let summoner_2 = get_summoner_asset(player.summoner2_id, &self.json, &self.locale).await?;
        let mut summoner_2 = Sprite::from_asset(&summoner_2, 0, 0).await?;
        summoner_2.resize_to_width(total_height / 2 - spacing);

        let items = vec![
            player.item0,
            player.item1,
            player.item2,
            player.item3,
            player.item4,
            player.item5,
            player.item6, //ward/oracle/farsight
        ];

        let item_background = Asset::new(AssetType::Other, "itemBackground.png");
        let mut item_background = Sprite::from_asset(&item_background, 0, 0).await?;
        item_background.resize_to_width(item_size);

        let text_color = if me { Color::Yellow } else { Color::White };

        let items = join_all(items.into_iter().enumerate().map(|(i, item_id)| {
            let item_background = item_background.clone();
            async move {
                let stack = Stack::new()
                    .child(item_background.clone())
                    .child_if(if item_id != 0 {
                        let asset = get_item_asset(item_id);
                        let mut sprite = Sprite::from_asset(&asset, 0, 0)
                            .await
                            .expect("Failed to read item asset")
                            .x(item_spacing as i32)
                            .y(item_spacing as i32);
                        sprite.resize_to_width(item_background.dimensions().0 - item_spacing * 2);
                        Some(sprite)
                    } else {
                        None
                    });

                if i == 6 {
                    stack.child(
                        Container::new()
                            .align_items(AlignItems::Center)
                            .justify(JustifyContent::Center)
                            .size(item_background.dimensions())
                            .child(
                                Label::new(player.vision_score.to_string())
                                    .bold()
                                    .size(36)
                                    .stroke(Color::Black, 2),
                            ),
                    )
                } else {
                    stack
                }
            }
        }))
        .await;

        let stats = try_join_all(vec![
            self.render_stat(Stat::Minions, player.total_minions_killed),
            self.render_stat(Stat::Damage, player.total_damage_dealt_to_champions),
            self.render_stat(Stat::Golds, player.gold_earned),
        ])
        .await?;

        Ok(Container::new()
            .direction(ContainerDirection::Row)
            .gap(spacing)
            .child(
                Stack::new().child(champion).child(
                    Container::new()
                        .width(champion_dimensions.0)
                        .height(total_height)
                        .align_items(AlignItems::End)
                        .justify(JustifyContent::Center)
                        .child(
                            Label::new(player.champ_level.to_string())
                                .size(level_text_size)
                                .bold()
                                .stroke(Color::Black, 4),
                        ),
                ),
            )
            .child(
                Container::new()
                    .height(champion_dimensions.1)
                    .width(260)
                    .direction(ContainerDirection::Column)
                    .justify(JustifyContent::SpaceBetween)
                    .align_items(if reversed {
                        AlignItems::End
                    } else {
                        AlignItems::Start
                    })
                    .child(
                        Container::new()
                            .direction(ContainerDirection::Column)
                            .align_items(if reversed {
                                AlignItems::End
                            } else {
                                AlignItems::Start
                            })
                            .child(
                                Label::new(player.riot_id_game_name.clone())
                                    .bold()
                                    .size(36)
                                    .color(text_color),
                            )
                            .child(
                                Label::new(format!("#{}", player.riot_id_tagline))
                                    .y(-10)
                                    .bold()
                                    .size(26)
                                    .color(text_color),
                            ),
                    )
                    .child(
                        Label::new(format!(
                            "{}/{}/{}",
                            player.kills, player.deaths, player.assists
                        ))
                        .bold()
                        .size(32),
                    ),
            )
            .child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .gap(spacing)
                    .child(rune)
                    .child(
                        Container::new()
                            .justify(JustifyContent::Center)
                            .align_items(AlignItems::Center)
                            .size(rune_dimensions)
                            .child(quest_or_secondary_rune),
                    ),
            )
            .child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .gap(spacing)
                    .child(summoner_1)
                    .child(summoner_2),
            )
            .child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .gap(spacing)
                    .child(
                        Container::new()
                            .direction(ContainerDirection::Row)
                            .gap(spacing)
                            .childs(items.into_iter())
                            .reverse_if(reversed),
                    )
                    .child(
                        Container::new()
                            .width(item_size * 7 + item_spacing * 6)
                            .justify(JustifyContent::SpaceBetween)
                            .childs(stats.into_iter()),
                    ),
            )
            .reverse_if(reversed))
    }

    pub async fn make_teams(
        &self,
        me_puuid: &str,
        participants: &[MatchParticipantInput],
    ) -> TaskResult<(Container, Container)> {
        let mut players = try_join_all(participants.into_iter().enumerate().map(|(i, p)| {
            let ctx = self.clone();
            async move { ctx.player_component(p, p.puuid == me_puuid, i >= 5).await }
        }))
        .await?;

        let teams = vec![players.drain(0..5).collect(), players];
        Ok(teams
            .into_iter()
            .map(|team| {
                Container::new()
                    .direction(ContainerDirection::Column)
                    .gap(15)
                    .childs(team.into_iter())
            })
            .collect_tuple()
            .unwrap())
    }
}

pub struct MatchTask;

impl Task for MatchTask {
    type Input = MatchTaskInput;

    const NAME: &'static str = "match";
    const JOB: WorkerJob = WorkerJob::Match;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let match_key = format!(
            "{}_{}_{}.png",
            input.default.puuid, input.metadata.match_id, input.default.locale
        );

        if let Some(result) = get_persistent_result(&match_key)? {
            return Ok(TaskOutcome::Existing(result));
        }

        let locale = AppLocale::from_str(&input.default.locale);
        let json: JsonCache = context.clone().into();

        let user_team = input
            .info
            .participants
            .iter()
            .find(|p| p.puuid == input.default.puuid)
            .map(|p| p.team_id)
            .expect("User team not found in match participants");
        let outcome = input
            .info
            .teams
            .iter()
            .find(|t| t.team_id == user_team)
            .map(|t| t.win)
            .expect("User team not found in match teams");

        let cross = Asset::new(AssetType::Other, "ban-x.png");
        let mut cross = Sprite::from_asset(&cross, 0, 0).await?;
        cross.resize_to_width(60);

        let left_team = &input.info.teams[0].bans;
        let right_team = &input.info.teams[1].bans;

        let ctx = RenderContext {
            json: Arc::new(json),
            locale: locale.clone(),
        };

        let (left_bans, right_bans) = tokio::join!(
            ctx.bans(left_team, cross.clone()),
            ctx.bans(right_team, cross.clone()),
        );

        let (left_players, right_players) = ctx
            .make_teams(&input.default.puuid, &input.info.participants)
            .await?;

        let center_spacing = 440;

        let tier_change_container = if let Some(change) = &input.tier_change {
            let rank_icon = match Sprite::from_asset(&get_rank_asset(&change.tier), 0, 0).await {
                Ok(mut sprite) => {
                    sprite.resize_to_width(200);
                    Some(sprite)
                }
                Err(_) => None,
            };

            let label_text = locale.tier_change_label(change.is_promotion);
            let color = if change.is_promotion {
                Color::Green
            } else {
                Color::Red
            };

            let text_container = Container::new()
                .direction(ContainerDirection::Column)
                .align_items(AlignItems::Center)
                .child(Label::new(label_text).color(color).bold().size(58));

            let text_container = if let Some(rank) = &change.rank {
                text_container.child(
                    Label::new(format!(
                        "{} {}",
                        locale.tier_label(&change.tier.as_str()),
                        rank.as_str()
                    ))
                    .color(change.tier.color())
                    .bold()
                    .size(56),
                )
            } else {
                text_container.child(
                    Label::new(locale.tier_label(&change.tier.as_str()))
                        .color(change.tier.color())
                        .bold()
                        .size(56),
                )
            };

            Some(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .padding_ltrb(0, 40, 0, 0)
                    .gap(8)
                    .child(text_container)
                    .child_if(rank_icon),
            )
        } else {
            None
        };

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into())
            .await?
            .with_layout(|root| {
                root.y(20)
                    .height_offset(-40)
                    .align_items(AlignItems::Center)
                    .direction(ContainerDirection::Column)
                    .child(
                        Container::new()
                            .align_items(AlignItems::Center)
                            .child(left_bans)
                            .child(
                                Container::new()
                                    .width(center_spacing)
                                    .justify(JustifyContent::Center)
                                    .child(
                                        Label::new(locale.outcome(outcome))
                                            .color(if outcome { Color::Green } else { Color::Red })
                                            .size(102)
                                            .bold(),
                                    ),
                            )
                            .child(right_bans),
                    )
                    .child(
                        Container::new()
                            .align_items(AlignItems::Start)
                            .child(left_players)
                            .child(
                                Container::new()
                                    .width(center_spacing)
                                    .direction(ContainerDirection::Column)
                                    .align_items(AlignItems::Center)
                                    .child(Label::new(input.queue_name).size(56).bold())
                                    .child(
                                        Label::new(format_duration(input.info.game_duration))
                                            .size(48)
                                            .bold(),
                                    )
                                    .child_if(
                                        if input.info.queue_id == 420 || input.info.queue_id == 440
                                        //Solo and Flex queue ids
                                        {
                                            Some(
                                                Label::new(format!(
                                                    "{} LP",
                                                    input
                                                        .lp_gain
                                                        .and_then(|lp| Some(lp.to_string()))
                                                        .or_else(|| Some("?".to_string()))
                                                        .unwrap()
                                                ))
                                                .color(match input.lp_gain {
                                                    Some(value) if value > 0 => Color::Green,
                                                    Some(value) if value < 0 => Color::Red,
                                                    _ => Color::White,
                                                })
                                                .bold()
                                                .size(56),
                                            )
                                        } else {
                                            None
                                        },
                                    )
                                    .child_if(tier_change_container),
                            )
                            .child(right_players),
                    )
                    .child(
                        Label::new(format_date(input.info.game_end_timestamp, &locale))
                            .bold()
                            .size(40),
                    )
            });

        Ok(TaskOutcome::Render(
            canvas,
            SaveStrategy::Persistent {
                filename: match_key,
            },
        ))
    }
}

mod test {
    #[tokio::test]
    async fn test_match_aram() {
        crate::assert_task!(super::MatchTask, "test_files/match_aram.json");
    }

    #[tokio::test]
    async fn test_match_flex_no_lp() {
        crate::assert_task!(super::MatchTask, "test_files/match_flex_no_lp.json");
    }

    #[tokio::test]
    async fn test_match_solo_gain() {
        crate::assert_task!(super::MatchTask, "test_files/match_solo_gain.json");
    }

    #[tokio::test]
    async fn test_match_solo_loss() {
        crate::assert_task!(super::MatchTask, "test_files/match_solo_loss.json");
    }

    #[tokio::test]
    async fn test_match_draft() {
        crate::assert_task!(super::MatchTask, "test_files/match_draft.json");
    }

    #[tokio::test]
    async fn test_match_prom_silver_gold() {
        crate::assert_task!(
            super::MatchTask,
            "test_files/match_prom_silver_gold.json"
        );
    }

    #[tokio::test]
    async fn test_match_prom_diamond_master() {
        crate::assert_task!(
            super::MatchTask,
            "test_files/match_prom_diamond_master.json"
        );
    }

    #[tokio::test]
    async fn test_match_dem_platinum_gold() {
        crate::assert_task!(
            super::MatchTask,
            "test_files/match_dem_platinum_gold.json"
        );
    }

    #[tokio::test]
    async fn test_match_dem_challenger_gm() {
        crate::assert_task!(
            super::MatchTask,
            "test_files/match_dem_challenger_gm.json"
        );
    }
}
