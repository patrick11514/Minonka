use std::sync::Arc;

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
use crate::tasks::task::SaveStrategy;
use crate::tasks::types::DefaultParametersInput;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::WorkerJob,
};
use crate::utils::assets::{
    get_background_asset, get_champion_asset, get_rune_asset, get_summoner_asset,
};
use crate::utils::format_duration;
use crate::utils::locale::AppLocale;
use crate::utils::rank::RankTier;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SpectatorPerksInput {
    pub perk_ids: Vec<u32>,
    pub perk_style: u32,
    pub perk_sub_style: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SpectatorParticipantInput {
    pub team_id: u32,
    pub champion_id: u32,
    pub riot_id: String,
    pub puuid: Option<String>,
    pub spell1_id: u32,
    pub spell2_id: u32,
    pub perks: SpectatorPerksInput,
    #[serde(default)]
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub rank: Option<RankTier>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SpectatorBannedChampionInput {
    pub champion_id: i32,
    pub team_id: u32,
    pub pick_turn: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SpectatorTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub queue_name: String,
    pub game_length: i32,
    pub map_name: String,
    pub participants: Vec<SpectatorParticipantInput>,
    pub banned_champions: Vec<SpectatorBannedChampionInput>,
    #[serde(default)]
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub is_cherry: Option<bool>,
}

#[derive(Clone)]
struct RenderContext {
    pub json: Arc<JsonCache>,
    pub locale: AppLocale,
}

impl RenderContext {
    pub async fn bans(&self, bans: &[Option<u32>], cross: Sprite) -> TaskResult<Container> {
        let mut childs = Vec::with_capacity(bans.len());
        let size = cross.dimensions();

        for &ban in bans {
            let cross = cross.clone();
            let champion = get_champion_asset(ban, &self.json, &self.locale).await?;
            let mut image = Sprite::from_asset(&champion, 0, 0).await?;
            image.resize_to_width(size.0);

            childs.push(Stack::new().child(image).child(cross));
        }

        Ok(Container::new()
            .direction(ContainerDirection::Row)
            .gap(10)
            .childs(childs.into_iter()))
    }

    pub async fn player_component(
        &self,
        player: &SpectatorParticipantInput,
        me: bool,
        reversed: bool,
        champion_size: u32,
    ) -> TaskResult<Container> {
        let champion =
            get_champion_asset(Some(player.champion_id), &self.json, &self.locale).await?;
        let mut champion = Sprite::from_asset(&champion, 0, 0).await?;
        champion.resize_to_width(champion_size);
        champion.roundify_circle();

        let text_color = if me { Color::Yellow } else { Color::White };

        let mut parts = player.riot_id.splitn(2, '#');
        let game_name = parts.next().unwrap_or("");
        let tag_line = parts.next().unwrap_or("");

        let name_tag_container = Container::new()
            .width(300)
            .direction(ContainerDirection::Column)
            .justify(JustifyContent::Center)
            .align_items(if reversed {
                AlignItems::End
            } else {
                AlignItems::Start
            })
            .child(Label::new(game_name).bold().size(35).color(text_color))
            .child(
                Label::new(format!("#{tag_line}"))
                    .bold()
                    .size(25)
                    .color(text_color),
            )
            .child(if let Some(rank) = &player.rank {
                Label::new(rank.as_str(&self.locale))
                    .bold()
                    .size(25)
                    .color(rank.tier().color())
            } else {
                Label::new(self.locale.unranked())
                    .bold()
                    .size(25)
                    .color(Color::Gray)
            });

        let player_info = Container::new()
            .direction(ContainerDirection::Row)
            .align_items(AlignItems::Center)
            .gap(15)
            .child(champion)
            .child(name_tag_container)
            .reverse_if(reversed);

        let rune_summoner_width = (champion_size * 50) / 88;
        let secondary_rune_width = (rune_summoner_width * 3) / 5;
        let icon_gap = if champion_size >= 88 { 10 } else { 6 };

        let summoner_1_asset =
            get_summoner_asset(player.spell1_id, &self.json, &self.locale).await?;
        let mut summoner_1 = Sprite::from_asset(&summoner_1_asset, 0, 0).await?;
        summoner_1.resize_to_width(rune_summoner_width);

        let summoner_2_asset =
            get_summoner_asset(player.spell2_id, &self.json, &self.locale).await?;
        let mut summoner_2 = Sprite::from_asset(&summoner_2_asset, 0, 0).await?;
        summoner_2.resize_to_width(rune_summoner_width);

        let summoners_column = Container::new()
            .direction(ContainerDirection::Column)
            .gap(icon_gap)
            .child(summoner_1)
            .child(summoner_2);

        let mut runes_and_summoners = Container::new()
            .direction(ContainerDirection::Row)
            .gap(10);

        if player.perks.perk_style > 0 {
            let style = player.perks.perk_style;
            let selection = player.perks.perk_ids.first().copied();
            let primary_rune_asset =
                get_rune_asset(style, selection, &self.json, &self.locale).await?;
            let mut primary_rune = Sprite::from_asset(&primary_rune_asset, 0, 0).await?;
            primary_rune.resize_to_width(rune_summoner_width);

            let secondary_style = player.perks.perk_sub_style;
            let secondary_rune_asset =
                get_rune_asset(secondary_style, None, &self.json, &self.locale).await?;
            let mut secondary_rune = Sprite::from_asset(&secondary_rune_asset, 0, 0).await?;
            secondary_rune.resize_to_width(secondary_rune_width);

            let runes_column = Container::new()
                .direction(ContainerDirection::Column)
                .align_items(AlignItems::Center)
                .gap(icon_gap)
                .child(primary_rune)
                .child(
                    Container::new()
                        .width(rune_summoner_width)
                        .height(rune_summoner_width)
                        .justify(JustifyContent::Center)
                        .align_items(AlignItems::Center)
                        .child(secondary_rune),
                );

            runes_and_summoners = runes_and_summoners.child(runes_column);
        }

        runes_and_summoners = runes_and_summoners
            .child(summoners_column)
            .reverse_if(reversed);

        Ok(Container::new()
            .direction(ContainerDirection::Row)
            .align_items(AlignItems::Center)
            .justify(JustifyContent::SpaceBetween)
            .child(player_info)
            .child(runes_and_summoners)
            .reverse_if(reversed))
    }

    async fn render_cherry(
        &self,
        input: &SpectatorTaskInput,
        canvas: MasterCanvas,
        cross: Sprite,
    ) -> TaskResult<TaskOutcome> {
        let size = canvas.dimensions();
        let players_per_side = (input.participants.len() as u32).div_ceil(2).max(1);
        let champion_size = ((size.1.saturating_sub(120)) / players_per_side)
            .saturating_sub(14)
            .clamp(68, 92);

        let split_at = input.participants.len().div_ceil(2);
        let mut left_players = Vec::with_capacity(split_at);
        let mut right_players = Vec::with_capacity(input.participants.len() - split_at);

        for (idx, player) in input.participants.iter().enumerate() {
            let reversed = idx >= split_at;
            let me = player.puuid.as_deref() == Some(&input.default.puuid);
            let comp = self
                .player_component(player, me, reversed, champion_size)
                .await?;
            if reversed {
                right_players.push(comp);
            } else {
                left_players.push(comp);
            }
        }

        let side_width = 640;
        let center_spacing = 440;

        let left_container = Container::new()
            .width(side_width)
            .gap(12)
            .direction(ContainerDirection::Column)
            .childs(left_players.into_iter());

        let right_container = Container::new()
            .width(side_width)
            .gap(12)
            .direction(ContainerDirection::Column)
            .childs(right_players.into_iter());

        let mut ban_cross = cross;
        ban_cross.resize_to_width(45);

        let ban_ids: Vec<Option<u32>> = input
            .banned_champions
            .iter()
            .map(|ban| {
                if ban.champion_id > 0 {
                    Some(ban.champion_id as u32)
                } else {
                    None
                }
            })
            .collect();

        let mut ban_rows = Vec::new();
        for chunk in ban_ids.chunks(5) {
            ban_rows.push(self.bans(chunk, ban_cross.clone()).await?);
        }

        let bans_grid = Container::new()
            .direction(ContainerDirection::Column)
            .align_items(AlignItems::Center)
            .gap(8)
            .childs(ban_rows.into_iter());

        let timer_label = if input.game_length <= -145 {
            Label::new(self.locale.loading_game()).size(72).bold()
        } else {
            let adjusted_length = (input.game_length + 145) as u32;
            Label::new(format_duration(adjusted_length))
                .size(72)
                .bold()
        };

        let center_container = Container::new()
            .width(center_spacing)
            .direction(ContainerDirection::Column)
            .align_items(AlignItems::Center)
            .gap(20)
            .child(Label::new(&input.queue_name).size(52).bold())
            .child(timer_label)
            .child(Label::new(&input.map_name).size(48).bold())
            .child_if(if !ban_ids.is_empty() {
                Some(bans_grid)
            } else {
                None
            });

        Ok(TaskOutcome::Render(
            canvas.with_layout(|root| {
                root.y(20)
                    .height_offset(-40)
                    .direction(ContainerDirection::Row)
                    .align_items(AlignItems::Center)
                    .justify(JustifyContent::Center)
                    .gap(20)
                    .child(left_container)
                    .child(center_container)
                    .child(right_container)
            }),
            SaveStrategy::Temporary,
        ))
    }
}

pub struct SpectatorTask;

impl Task for SpectatorTask {
    type Input = SpectatorTaskInput;

    const NAME: &'static str = "spectator";
    const JOB: WorkerJob = WorkerJob::Spectator;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let locale = AppLocale::from_str(&input.default.locale);
        let render_context = RenderContext {
            json: Arc::new(context.clone().into()),
            locale,
        };

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into()).await?;

        let cross_asset =
            crate::utils::assets::Asset::new(crate::utils::assets::AssetType::Other, "ban-x.png");
        let mut cross = Sprite::from_asset(&cross_asset, 0, 0).await?;

        if input.is_cherry.unwrap_or(false) {
            return render_context.render_cherry(&input, canvas, cross).await;
        }

        cross.resize_to_width(55);

        let left_ban_ids: Vec<Option<u32>> = input
            .banned_champions
            .iter()
            .filter(|ban| ban.team_id == 100)
            .map(|ban| {
                if ban.champion_id > 0 {
                    Some(ban.champion_id as u32)
                } else {
                    None
                }
            })
            .collect();

        let right_ban_ids: Vec<Option<u32>> = input
            .banned_champions
            .iter()
            .filter(|ban| ban.team_id != 100)
            .map(|ban| {
                if ban.champion_id > 0 {
                    Some(ban.champion_id as u32)
                } else {
                    None
                }
            })
            .collect();

        let left_bans = render_context.bans(&left_ban_ids, cross.clone()).await?;
        let right_bans = render_context.bans(&right_ban_ids, cross.clone()).await?;

        let mut left_players = Vec::new();
        let mut right_players = Vec::new();

        for player in &input.participants {
            let reversed = player.team_id != 100;
            let me = player.puuid.as_deref() == Some(&input.default.puuid);
            let comp = render_context
                .player_component(player, me, reversed, 88)
                .await?;
            if player.team_id == 100 {
                left_players.push(comp);
            } else {
                right_players.push(comp);
            }
        }

        let left_team_container = Container::new()
            .gap(15)
            .direction(ContainerDirection::Column)
            .justify(JustifyContent::SpaceBetween)
            .childs(left_players.into_iter());

        let right_team_container = Container::new()
            .gap(15)
            .direction(ContainerDirection::Column)
            .justify(JustifyContent::SpaceBetween)
            .childs(right_players.into_iter());

        let size = canvas.dimensions();

        Ok(TaskOutcome::Render(
            canvas.with_layout(|root| {
                root.direction(ContainerDirection::Column)
                    .child(
                        Container::new()
                            .width(size.0 - 100)
                            .direction(ContainerDirection::Row)
                            .x(50)
                            .y(50)
                            .align_items(AlignItems::Center)
                            .justify(JustifyContent::SpaceBetween)
                            .child(
                                Container::new()
                                    .direction(ContainerDirection::Column)
                                    .align_items(AlignItems::Start)
                                    .gap(5)
                                    .child(Label::new(&input.queue_name).size(60).bold())
                                    .child(left_bans),
                            )
                            .child(
                                if input.game_length <= -145 {
                                    Label::new(render_context.locale.loading_game())
                                        .size(80)
                                        .bold()
                                } else {
                                    let adjusted_length = (input.game_length + 145) as u32;
                                    Label::new(format_duration(adjusted_length))
                                        .size(80)
                                        .bold()
                                }
                            )
                            .child(
                                Container::new()
                                    .direction(ContainerDirection::Column)
                                    .align_items(AlignItems::End)
                                    .gap(5)
                                    .child(Label::new(&input.map_name).size(60).bold())
                                    .child(right_bans),
                            ),
                    )
                    .child(
                        Container::new()
                            .x(80)
                            .y(60)
                            .width(size.0 - 120)
                            .direction(ContainerDirection::Row)
                            .justify(JustifyContent::SpaceBetween)
                            .child(left_team_container)
                            .child(right_team_container),
                    )
            }),
            SaveStrategy::Temporary,
        ))
    }
}

mod test {
    #[tokio::test]
    async fn test_spectator() {
        crate::assert_task!(super::SpectatorTask, "test_files/spectator.json");
    }

    #[tokio::test]
    async fn test_spectator_cs() {
        crate::assert_task!(super::SpectatorTask, "test_files/spectator_cs.json");
    }

    #[tokio::test]
    async fn test_spectator_streamer() {
        crate::assert_task!(super::SpectatorTask, "test_files/spectator_streamer.json");
    }

    #[tokio::test]
    async fn test_spectator_cherry() {
        crate::assert_task!(super::SpectatorTask, "test_files/spectator_cherry.json");
    }
}
