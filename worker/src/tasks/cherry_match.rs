use std::collections::HashMap;
use std::sync::Arc;

use futures::future::{join_all, try_join_all};
use itertools::Itertools;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::cache::json::JsonCache;
use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection, JustifyContent};
use crate::draw::label::Label;
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::draw::stack::Stack;
use crate::tasks::error::TaskError;
use crate::tasks::task::SaveStrategy;
use crate::tasks::types::DefaultParametersInput;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{MatchMetadataInput, WorkerJob},
};
use crate::utils::assets::{
    Asset, AssetType, OnlineAsset, Stat, get_background_asset, get_item_asset, get_stat_asset,
    get_summoner_asset,
};
use crate::utils::locale::AppLocale;
use crate::utils::storage::get_persistent_result;
use crate::utils::{fix_champion_name, format_date, format_duration, format_with_spaces};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct CherryMatchInfoInput {
    pub game_end_timestamp: i64,
    pub game_duration: u32,
    pub queue_id: u32,
    pub participants: Vec<CherryMatchParticipantInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct CherryMatchParticipantInput {
    pub puuid: String,
    pub champ_level: u32,
    pub champion_name: String,
    pub riot_id_game_name: String,
    pub riot_id_tagline: String,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub player_subteam_id: u32,
    pub subteam_placement: u32,
    pub player_augment1: u32,
    pub player_augment2: u32,
    pub player_augment3: u32,
    pub player_augment4: u32,
    pub player_augment5: Option<u32>,
    pub player_augment6: Option<u32>,
    pub item0: u32,
    pub item1: u32,
    pub item2: u32,
    pub item3: u32,
    pub item4: u32,
    pub item5: u32,
    pub item6: u32,
    pub summoner1_id: u32,
    pub summoner2_id: u32,
    pub total_damage_dealt_to_champions: u32,
    pub gold_earned: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct CherryMatchTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub metadata: MatchMetadataInput,
    pub info: CherryMatchInfoInput,
    pub queue_name: String,
}

#[derive(Debug, Clone)]
enum SubTeam {
    Poro,
    Minion,
    Scuttle,
    Krug,
    Raptor,
    Sentinel,
    Wolf,
    Gromp,
}

impl SubTeam {
    pub fn to_file(&self) -> &str {
        match self {
            SubTeam::Poro => "poros",
            SubTeam::Minion => "minions",
            SubTeam::Scuttle => "scuttles",
            SubTeam::Krug => "krugs",
            SubTeam::Raptor => "raptors",
            SubTeam::Sentinel => "sentinel",
            SubTeam::Wolf => "wolves",
            SubTeam::Gromp => "gromp",
        }
    }

    pub fn to_asset(&self) -> Asset {
        Asset::new(
            AssetType::Online(OnlineAsset::CommunityDragon),
            format!(
                "/game/assets/ux/cherry/teamicons/team{}.png",
                self.to_file()
            ),
        )
    }

    pub fn to_locale(&self, locale: &AppLocale) -> String {
        (match locale {
            AppLocale::Cz => match self {
                SubTeam::Poro => "Poro",
                SubTeam::Minion => "Poskok",
                SubTeam::Scuttle => "Krab",
                SubTeam::Krug => "Kameňák",
                SubTeam::Raptor => "Raptor",
                SubTeam::Sentinel => "Strážce",
                SubTeam::Wolf => "Vlk",
                SubTeam::Gromp => "Ropušák",
            },
            AppLocale::En => match self {
                SubTeam::Poro => "Poro",
                SubTeam::Minion => "Minion",
                SubTeam::Scuttle => "Scuttle",
                SubTeam::Krug => "Krug",
                SubTeam::Raptor => "Raptor",
                SubTeam::Sentinel => "Sentinel",
                SubTeam::Wolf => "Wolf",
                SubTeam::Gromp => "Gromp",
            },
        })
        .to_string()
    }
}

impl From<u32> for SubTeam {
    fn from(value: u32) -> Self {
        match value {
            1 => SubTeam::Poro,
            2 => SubTeam::Minion,
            3 => SubTeam::Scuttle,
            4 => SubTeam::Krug,
            5 => SubTeam::Raptor,
            6 => SubTeam::Sentinel,
            7 => SubTeam::Wolf,
            8 => SubTeam::Gromp,
            _ => panic!("Unknown subteam id: {}", value),
        }
    }
}

#[derive(Clone)]
struct RenderContext {
    pub json: Arc<JsonCache>,
    pub locale: AppLocale,
}

impl RenderContext {
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
        player: &CherryMatchParticipantInput,
        height: u32,
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

        let offset = 10;
        let mut champion = Sprite::from_asset(&champion, 0, 0).await?;
        champion.resize_to_width(height - offset);

        let mut champion_dimensions = champion.dimensions();
        champion_dimensions.1 += offset;

        let total_height = champion_dimensions.1;
        let spacing = 5;
        let item_spacing = 4;

        let augments = self
            .json
            .get_aguments(&self.locale)
            .await?
            .expect("Augments to be found");

        let item_background = Asset::new(AssetType::Other, "/itemBackground.png".to_string());
        let mut item_background = Sprite::from_asset(&item_background, 0, 0).await?;
        item_background.resize_to_width(total_height / 2 - 2);

        let item_size = item_background.dimensions().0 - item_spacing * 2;

        let augment_width = item_background.dimensions().0;

        let mut augments = try_join_all(
            vec![
                Some(player.player_augment1),
                Some(player.player_augment2),
                Some(player.player_augment3),
                Some(player.player_augment4),
                player.player_augment5,
                player.player_augment6,
            ]
            .into_iter()
            .map(|augment_id| {
                let augments = &augments.augments;
                async move {
                    let augment_id = match augment_id {
                        Some(id) => id,
                        None => return Ok::<Option<Sprite>, TaskError>(None),
                    };

                    let path = match augments.iter().find(|a| a.id == augment_id) {
                        Some(augment) => augment.icon_large.clone(),
                        None => return Ok(None),
                    };

                    let asset = Asset::new(
                        AssetType::Online(OnlineAsset::CommunityDragon),
                        format!("/game/{}", path),
                    );

                    let mut sprite = Sprite::from_asset(&asset, 0, 0).await?;
                    sprite.resize_to_width(augment_width);
                    Ok(Some(sprite))
                }
            }),
        )
        .await?;

        let top = augments.split_off(3);
        let augments = vec![augments, top];

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
        item_background.resize_to_width(total_height / 2 - spacing);

        let items = join_all(items.into_iter().map(|item_id| {
            let item_background = item_background.clone();
            async move {
                Stack::new()
                    .child(item_background.clone())
                    .child_if(if item_id != 0 {
                        let asset = get_item_asset(item_id);
                        if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                            sprite = sprite
                                .x(item_spacing as i32)
                                .y(item_spacing as i32);
                            sprite.resize_to_width(item_background.dimensions().0 - item_spacing * 2);
                            Some(sprite)
                        } else {
                            None
                        }
                    } else {
                        None
                    })
            }
        }))
        .await;

        let stats = try_join_all(vec![
            self.render_stat(Stat::Damage, player.total_damage_dealt_to_champions),
            self.render_stat(Stat::Golds, player.gold_earned),
        ])
        .await?;

        Ok(Container::new()
            .gap(10)
            .child(
                Stack::new()
                    .size(champion_dimensions.clone())
                    .child(champion)
                    .child(
                        Container::new()
                            .size(champion_dimensions)
                            .justify(JustifyContent::Center)
                            .align_items(AlignItems::End)
                            .child(
                                Label::new(player.champ_level.to_string())
                                    .size(24)
                                    .bold()
                                    .stroke(Color::Black, 2),
                            ),
                    ),
            )
            .child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .align_items(if reversed {
                        AlignItems::End
                    } else {
                        AlignItems::Start
                    })
                    .width(240)
                    .justify(JustifyContent::SpaceBetween)
                    .height(champion_dimensions.1)
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
                                    .size(26)
                                    .color(if me { Color::Yellow } else { Color::White }),
                            )
                            .child(
                                Label::new(format!("#{}", player.riot_id_tagline))
                                    .size(20)
                                    .y(-8)
                                    .bold()
                                    .color(if me { Color::Yellow } else { Color::White }),
                            ),
                    )
                    .child(
                        Label::new(format!(
                            "{}/{}/{}",
                            player.kills, player.deaths, player.assists
                        ))
                        .bold()
                        .size(30),
                    ),
            )
            .child(
                Container::new()
                    .gap(2)
                    .direction(ContainerDirection::Column)
                    .childs(augments.into_iter().map(|row| {
                        Container::new()
                            .gap(2)
                            .childs_if(row.into_iter().map(|augment| {
                                Some(
                                    Stack::new()
                                        .child(item_background.clone())
                                        .child_if(augment),
                                )
                            }))
                    })),
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

    async fn make_teams(
        &self,
        teams: Vec<(u32, u32, Vec<String>)>,
        me: &str,
        participants: &[CherryMatchParticipantInput],
        background_height: u32,
    ) -> TaskResult<(Container, Container)> {
        let team_len = teams.len() as u32;

        let people_per_team = participants.len() as u32 / team_len;
        let teams_per_side = team_len / 2;
        let players_per_side = people_per_team * teams_per_side;

        let player_height = (background_height / players_per_side) - 2 * players_per_side;

        let player_team = participants
            .iter()
            .find(|p| p.puuid == me)
            .map(|p| p.player_subteam_id)
            .expect("Player to be found in participants");

        let mut players: HashMap<String, Container> = try_join_all(participants.iter().map(|p| {
            let puuid = p.puuid.clone();
            async move {
                let player = self
                    .player_component(
                        p,
                        player_height,
                        puuid == me,
                        p.subteam_placement > teams_per_side,
                    )
                    .await?;

                Ok::<(String, Container), TaskError>((puuid, player))
            }
        }))
        .await?
        .into_iter()
        .collect();

        let teams = teams
            .into_iter()
            .map(|(id, placement, ids)| {
                (
                    id,
                    placement,
                    ids.into_iter()
                        .filter_map(|id| players.remove(&id))
                        .collect::<Vec<_>>(),
                )
            })
            .collect_vec();

        let mut teams = try_join_all(teams.into_iter().map(|team| async move {
            let team_logo = SubTeam::from(team.0).to_asset();
            let mut team_logo = Sprite::from_asset(&team_logo, 0, 0).await?;
            team_logo.resize_to_width(80);

            let color = if team.0 == player_team {
                Color::Yellow
            } else {
                Color::White
            };

            Ok::<_, TaskError>(
                Container::new()
                    .gap(20)
                    .child(
                        Container::new()
                            .direction(ContainerDirection::Column)
                            .align_items(AlignItems::Center)
                            .child(team_logo)
                            .child(
                                Label::new(format!("{}.", team.1))
                                    .size(24)
                                    .bold()
                                    .color(color),
                            )
                            .child(Label::new(self.locale.team()).size(26).bold().color(color))
                            .child(
                                Label::new(SubTeam::from(team.0).to_locale(&self.locale))
                                    .size(26)
                                    .bold()
                                    .color(color),
                            ),
                    )
                    .child(
                        Container::new()
                            .gap(10)
                            .direction(ContainerDirection::Column)
                            .childs(team.2),
                    ),
            )
        }))
        .await?;

        let teams = vec![teams.drain(0..(teams.len() / 2)).collect(), teams];
        Ok(teams
            .into_iter()
            .enumerate()
            .map(|(i, team)| {
                Container::new()
                    .direction(ContainerDirection::Column)
                    .gap(10)
                    .childs(team.into_iter().map(|c| c.reverse_if(i > 0)))
            })
            .collect_tuple()
            .unwrap())
    }
}

pub struct CherryMatchTask;

impl Task for CherryMatchTask {
    type Input = CherryMatchTaskInput;

    const NAME: &'static str = "cherryMatch";
    const JOB: WorkerJob = WorkerJob::CherryMatch;

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

        let ctx = RenderContext {
            json: Arc::new(json),
            locale: locale.clone(),
        };

        let mut teams = input.info.participants.iter().fold(
            vec![],
            |mut acc: Vec<(u32, u32, Vec<String>)>, p| {
                let team_id = p.player_subteam_id;
                if let Some(team) = acc.iter_mut().find(|(id, _, _)| id == &team_id) {
                    team.2.push(p.puuid.clone());
                    acc
                } else {
                    acc.push((team_id, p.subteam_placement, vec![p.puuid.clone()]));
                    acc
                }
            },
        );

        teams.sort_by(|a, b| a.1.cmp(&b.1));

        let pos = input
            .info
            .participants
            .iter()
            .find(|p| p.puuid == input.default.puuid)
            .map(|p| p.subteam_placement)
            .unwrap();

        let half = (teams.len() / 2) as u32;

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into()).await?;
        let background_height = canvas.dimensions().1;

        let (left_players, right_players) = ctx
            .make_teams(
                teams,
                &input.default.puuid,
                &input.info.participants,
                background_height,
            )
            .await?;

        let center_spacing = 440;

        let canvas = canvas.with_layout(|root| -> _ {
            root.y(20)
                .height_offset(-40)
                .align_items(AlignItems::Center)
                .direction(ContainerDirection::Column)
                .child(
                    Container::new()
                        .align_items(AlignItems::Start)
                        .child(left_players)
                        .child(
                            Container::new()
                                .width(center_spacing)
                                .direction(ContainerDirection::Column)
                                .align_items(AlignItems::Center)
                                .child(
                                    Label::new(format!("{}. {}", pos, locale.place()))
                                        .bold()
                                        .size(72)
                                        .color(if pos <= half {
                                            Color::Green
                                        } else {
                                            Color::Red
                                        }),
                                )
                                .child(Label::new(input.queue_name).size(56).bold())
                                .child(
                                    Label::new(format_duration(input.info.game_duration))
                                        .size(48)
                                        .bold(),
                                ),
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
    async fn test_cherry_match_1st() {
        crate::assert_task!(super::CherryMatchTask, "test_files/cherryMatch_1st.json");
    }

    #[tokio::test]
    async fn test_cherry_match_8th() {
        crate::assert_task!(super::CherryMatchTask, "test_files/cherryMatch_8th.json");
    }
}
