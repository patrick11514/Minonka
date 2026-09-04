use serde::{Deserialize, Serialize};
use ts_rs::TS;

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
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, WorkerJob},
};
use crate::utils::assets::{
    Asset, AssetType, asset_path, get_background_asset, get_lossstreak_asset, get_profile_icon,
    get_rank_asset, get_winstreak_asset,
};
use crate::utils::locale::AppLocale;
use crate::utils::rank::Tier;
use crate::utils::rank_to_label;

use crate::tasks::summoner::StreakInput;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct RankQueueEntryInput {
    pub queue_type: String,
    pub wins: u32,
    pub losses: u32,
    pub tier: String,
    pub rank: String,
    pub league_points: i32,
    #[cfg_attr(feature = "export-ts", ts(optional))]
    pub streak: Option<StreakInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct RankTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    #[serde(flatten)]
    pub profile: ProfileParametersInput,
    pub ranks: Vec<RankQueueEntryInput>,
}

pub struct RankTask;

impl Task for RankTask {
    type Input = RankTaskInput;

    const NAME: &'static str = "rank";
    const JOB: WorkerJob = WorkerJob::Rank;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let locale = AppLocale::from_str(&input.default.locale);

        let avatar_asset = get_profile_icon(input.profile.profile_icon_id).await?;
        let avatar_path = asset_path(&avatar_asset).await?;

        let mut resolved_ranks = Vec::new();
        for rank_entry in input.ranks {
            let rank_asset = get_rank_asset(&Tier::from(&rank_entry.tier));
            let rank_path = asset_path(&rank_asset).await?;
            resolved_ranks.push((rank_entry, rank_path));
        }

        let mut avatar_sprite = Sprite::from_path(&avatar_path.to_string_lossy(), 0, 16)?;
        avatar_sprite.resize_to_width(360);

        let level_background = Asset::new(AssetType::Other, "level.png");
        let mut level_background = Sprite::from_asset(&level_background, 0, 0).await?;
        level_background.resize_to_width(160);
        let center_of_level_background = level_background.dimensions().0 / 2;

        let left_column = Container::new()
            .direction(ContainerDirection::Column)
            .align_items(AlignItems::Center)
            .gap(40)
            .x(80)
            .child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .child(
                        Label::new(locale.region(&input.default.region).to_ascii_uppercase())
                            .size(56)
                            .bold(),
                    )
                    .child(
                        Stack::new().child(level_background).child(
                            Label::new(input.profile.level.to_string())
                                .size(56)
                                .bold()
                                .x(center_of_level_background as i32)
                                .align(Alignment::Middle),
                        ),
                    ),
            )
            .child(avatar_sprite)
            .child(
                Label::new(format!(
                    "{}#{}",
                    input.profile.game_name, input.profile.tag_line
                ))
                .size(56)
                .bold(),
            );

        let mut ranks_row = Container::new()
            .direction(ContainerDirection::Row)
            .justify(JustifyContent::Center)
            .gap(240);

        for (rank_entry, rank_path) in resolved_ranks {
            let mut rank_sprite = Sprite::from_path(&rank_path.to_string_lossy(), 0, 0)?;
            rank_sprite.resize_to_width(250);

            let total_games = rank_entry.wins + rank_entry.losses;
            let win_rate = if total_games > 0 {
                (rank_entry.wins as f32 / total_games as f32) * 100.0
            } else {
                0.0
            };

            let streak_container = if let Some(streak) = &rank_entry.streak {
                let is_win = streak.r#type == "win";
                let asset = if is_win {
                    get_winstreak_asset()
                } else {
                    get_lossstreak_asset()
                };

                if let Ok(mut icon) = Sprite::from_asset(&asset, 0, 0).await {
                    icon.resize_to_width(40);
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
                            .child(Label::new(text).bold().size(44).color(color)),
                    )
                } else {
                    None
                }
            } else {
                None
            };

            ranks_row = ranks_row.child(
                Container::new()
                    .direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .gap(4)
                    .child(
                        Label::new(locale.queue_label(&rank_entry.queue_type))
                            .size(64)
                            .bold(),
                    )
                    .child(
                        rank_to_label(&rank_entry.tier, &rank_entry.rank, &locale)
                            .size(60)
                            .bold(),
                    )
                    .child(rank_sprite)
                    .child(
                        Label::new(format!("{} LP", rank_entry.league_points))
                            .size(60)
                            .bold(),
                    )
                    .child(
                        Label::new(format!("WR: {:.2}%", win_rate))
                            .size(60)
                            .bold()
                            .color(if win_rate < 50.0 {
                                Color::Red
                            } else {
                                Color::Green
                            }),
                    )
                    .child(
                        Label::new(format!("Wins - {}", rank_entry.wins))
                            .size(60)
                            .bold()
                            .color(Color::Green),
                    )
                    .child(
                        Label::new(format!("Losses - {}", rank_entry.losses))
                            .size(60)
                            .bold()
                            .color(Color::Red),
                    )
                    .child_if(streak_container),
            );
        }

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into())
            .await?
            .with_layout(|root| {
                root.padding(10)
                    .direction(ContainerDirection::Row)
                    .justify(JustifyContent::SpaceBetween)
                    .align_items(AlignItems::Center)
                    .splits(vec![30, 70])
                    .child(left_column)
                    .child(ranks_row)
            });

        Ok(TaskOutcome::Render(canvas, SaveStrategy::Temporary))
    }
}

mod test {
    #[tokio::test]
    async fn test_rank_single_solo() {
        crate::assert_task!(super::RankTask, "test_files/rank_single_solo.json");
    }

    #[tokio::test]
    async fn test_rank_single_flex() {
        crate::assert_task!(super::RankTask, "test_files/rank_single_flex.json");
    }

    #[tokio::test]
    async fn test_rank_multiple() {
        crate::assert_task!(super::RankTask, "test_files/rank_multiple.json");
    }

    #[tokio::test]
    async fn test_rank_multiple_2() {
        crate::assert_task!(super::RankTask, "test_files/rank_multiple_2.json");
    }

    #[tokio::test]
    async fn test_rank_empty() {
        crate::assert_task!(super::RankTask, "test_files/rank_empty.json");
    }
}
