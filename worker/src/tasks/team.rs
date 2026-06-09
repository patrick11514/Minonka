use std::sync::Arc;

use futures::future::try_join_all;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::cache::json::JsonCache;
use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection, JustifyContent};
use crate::draw::label::Label;
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::rich_label::RichLabel;
use crate::draw::sprite::Sprite;
use crate::draw::stack::Stack;
use crate::tasks::task::SaveStrategy;
use crate::tasks::types::{DefaultParametersInput, ProfileParametersInput};
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::WorkerJob,
};
use crate::utils::assets::{
    Asset, AssetType, get_background_asset, get_champion_asset, get_profile_icon, get_rooster_asset,
};
use crate::utils::locale::AppLocale;
use crate::utils::rank::RankTier;
use crate::utils::{FormatNumber, format_number};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct TeamTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub abbreviation: String,
    pub name: String,
    pub icon_id: u32,
    pub tier: u32,
    pub captain: String,
    pub players: Vec<ClashPlayer>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct ClashPlayer {
    #[serde(flatten)]
    pub profile: ProfileParametersInput,
    pub puuid: String,
    pub position: String, // Matches standard position enum strings (e.g., 'TOP', 'JUNGLE')
    pub role: String,     // 'CAPTAIN' | 'MEMBER'
    pub highest_rank: Option<RankData>,
    pub masteries: Vec<MasteryData>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct RankData {
    pub queue_type: String,
    pub wins: i32,
    pub losses: i32,
    #[serde(flatten)]
    pub rank: RankTier,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct MasteryData {
    pub champion_id: u32,
    pub champion_level: u32,
    pub champion_points: u32,
    pub last_play_time: i64,
}

#[derive(Clone)]
struct RenderContext {
    pub json: Arc<JsonCache>,
    pub locale: AppLocale,
}

impl RenderContext {
    async fn render_mastery(&self, mastery: &MasteryData) -> TaskResult<Container> {
        let champion =
            get_champion_asset(Some(mastery.champion_id), &self.json, &self.locale).await?;
        let mut champion = Sprite::from_asset(&champion, 0, 0).await?;
        champion.resize_to_width(80);
        let size = champion.dimensions();

        Ok(Container::new()
            .gap(5)
            .direction(ContainerDirection::Column)
            .align_items(AlignItems::Center)
            .child(
                Stack::new().child(champion).child(
                    Container::new()
                        .width(size.0)
                        .y(size.1 as i32 - 25)
                        .justify(JustifyContent::Center)
                        .child(
                            Label::new(mastery.champion_level.to_string())
                                .size(32)
                                .bold()
                                .stroke(Color::Black, 2),
                        ),
                ),
            )
            .child(
                Label::new(format_number(
                    mastery.champion_points,
                    FormatNumber::Highest,
                ))
                .size(32)
                .bold()
                .stroke(Color::Black, 2),
            ))
    }

    pub async fn player_component(
        &self,
        player: &ClashPlayer,
        me: bool,
        captain: bool,
    ) -> TaskResult<Container> {
        let icon = get_profile_icon(player.profile.profile_icon_id).await?;
        let mut icon = Sprite::from_asset(&icon, 0, 0).await?;
        icon.resize_to_width(110);

        let icon_size = icon.dimensions();

        let level = Asset::new(AssetType::Other, "level.png");
        let mut level_background = Sprite::from_asset(&level, 0, 0).await?;
        level_background.resize_to_width(icon_size.0 - 40);
        let level_size = level_background.dimensions();

        let crown = if captain {
            let crown = Asset::new(AssetType::Other, "crown.png");
            let mut crown = Sprite::from_asset(&crown, 0, 0).await?.y(-20);
            crown.resize_to_width(30);

            Some(crown)
        } else {
            None
        };

        let color = if me { Color::Yellow } else { Color::White };
        let text_size = 40;

        let masteries =
            try_join_all(player.masteries.iter().map(|m| self.render_mastery(m))).await?;

        Ok(Container::new()
            .gap(5)
            .direction(ContainerDirection::Column)
            .align_items(AlignItems::Center)
            .child(
                Container::new()
                    .gap(10)
                    .child(
                        Stack::new().child(icon).child(
                            Container::new()
                                .width(icon_size.0)
                                .y(-10)
                                .justify(JustifyContent::Center)
                                .child(
                                    Stack::new()
                                        .align_center()
                                        .child(level_background)
                                        .child(
                                            Label::new(player.profile.level.to_string())
                                                .size(level_size.0 / 2 - 5)
                                                .bold(),
                                        )
                                        .child_if(crown),
                                ),
                        ),
                    )
                    .child(
                        Container::new()
                            .y(-5)
                            .height(icon_size.1)
                            .direction(ContainerDirection::Column)
                            .justify(JustifyContent::SpaceBetween)
                            .child(
                                Label::new(format!(
                                    "{}#{}",
                                    player.profile.game_name, player.profile.tag_line
                                ))
                                .bold()
                                .size(text_size)
                                .color(color),
                            )
                            .child_if(player.highest_rank.clone().and_then(|data| {
                                Some(
                                    RichLabel::new()
                                        .size(text_size)
                                        .bold()
                                        .text_colored(
                                            data.rank.as_str(&self.locale),
                                            data.rank.tier().color(),
                                        )
                                        .text(format!(
                                            " ({})",
                                            self.locale.queue_label(&data.queue_type)
                                        )),
                                )
                            }))
                            .child({
                                let mut label = RichLabel::new()
                                    .size(text_size)
                                    .bold()
                                    .text(self.locale.lane(&player.position));

                                if let Some(rank) = &player.highest_rank {
                                    label = label
                                        .text(" (")
                                        .text_colored(format!("{}W", rank.wins), Color::Green)
                                        .text("/")
                                        .text_colored(format!("{}L", rank.losses), Color::Red)
                                        .text(")");
                                }
                                label
                            }),
                    ),
            )
            .child(Container::new().gap(10).childs(masteries.into_iter())))
    }
}

pub struct TeamTask;

impl Task for TeamTask {
    type Input = TeamTaskInput;

    const NAME: &'static str = "team";
    const JOB: WorkerJob = WorkerJob::Team;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let locale = AppLocale::from_str(&input.default.locale);

        let rooster = get_rooster_asset(input.icon_id);
        let mut rooster = Sprite::from_asset(&rooster, 0, 0).await?;
        rooster.resize_to_width(120);

        let render_context = RenderContext {
            json: Arc::new(context.clone().into()),
            locale: locale.clone(),
        };
        let players = try_join_all(input.players.iter().map(|player| async {
            let is_captain = player.puuid == input.captain;

            render_context
                .player_component(player, player.puuid == input.default.puuid, is_captain)
                .await
                .and_then(|container| Ok((container, is_captain)))
        }))
        .await?;

        let mut captain = None;

        let mut player_containers = Vec::with_capacity(players.len().saturating_sub(1));

        for (container, is_active) in players {
            if is_active {
                captain = Some(container);
            } else {
                player_containers.push(container);
            }
        }

        let captain = captain.expect("Expected exactly one container to be true");

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into()).await?;
        let dimensions = canvas.dimensions();

        Ok(TaskOutcome::Render(
            canvas.with_layout(|root| {
                root.direction(ContainerDirection::Column)
                    .gap(80)
                    .align_items(AlignItems::Center)
                    .child(
                        Container::new()
                            .y(40)
                            .align_items(AlignItems::Center)
                            .justify(JustifyContent::Center)
                            .gap(20)
                            .child(rooster)
                            .child(
                                Label::new(&input.abbreviation)
                                    .color(Color::Gray)
                                    .size(72)
                                    .bold(),
                            )
                            .child(Label::new(&input.name).size(64).bold()),
                    )
                    .child(captain)
                    .child(
                        Container::new()
                            .y(-280)
                            .gap(30)
                            .width(dimensions.0 - dimensions.0 / 4)
                            .wrap(true)
                            .max_items_per_line(2)
                            .justify(JustifyContent::SpaceBetween)
                            .childs(player_containers.into_iter()),
                    )
            }),
            SaveStrategy::Temporary,
        ))
    }
}

mod test {
    #[tokio::test]
    async fn test_team_fill() {
        crate::assert_task!(super::TeamTask, "test_files/team_fill.json");
    }

    #[tokio::test]
    async fn test_team_casual() {
        crate::assert_task!(super::TeamTask, "test_files/team_casual.json");
    }

    #[tokio::test]
    async fn test_team_rich() {
        crate::assert_task!(super::TeamTask, "test_files/team_rich.json");
    }

    #[tokio::test]
    async fn test_team_solo() {
        crate::assert_task!(super::TeamTask, "test_files/team_solo.json");
    }

    #[tokio::test]
    async fn test_team_3() {
        crate::assert_task!(super::TeamTask, "test_files/team_3.json");
    }

    #[tokio::test]
    async fn test_team_full() {
        crate::assert_task!(super::TeamTask, "test_files/team_full.json");
    }
}
