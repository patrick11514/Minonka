use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, FlexDirection, JustifyContent};
use crate::draw::label::{Alignment, Label};
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::draw::stack::Stack;
use crate::tasks::task::SaveStrategy;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, WorkerJob},
};
use crate::utils::assets::{
    Asset, AssetType, Rank, asset_path, get_background_asset, get_profile_icon, get_rank_asset,
};
use crate::utils::locale::AppLocale;

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
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct RankTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub ranks: Vec<RankQueueEntryInput>,
}

pub struct RankTask;

fn rank_color(tier: &str) -> Color {
    match tier {
        "CHALLENGER" => Color::from_hex("#E8CD7F"),
        "GRANDMASTER" => Color::from_hex("#D34C5C"),
        "MASTER" => Color::from_hex("#9F5FE0"),
        "DIAMOND" => Color::from_hex("#58B9E8"),
        "EMERALD" => Color::from_hex("#4CCF9A"),
        "PLATINUM" => Color::from_hex("#42B7AA"),
        "GOLD" => Color::from_hex("#D9B14A"),
        "SILVER" => Color::from_hex("#BDC3C7"),
        "BRONZE" => Color::from_hex("#B27A50"),
        "IRON" => Color::from_hex("#9A8F8F"),
        _ => Color::White,
    }
}

impl Task for RankTask {
    type Input = RankTaskInput;

    const NAME: &'static str = "rank";
    const JOB: WorkerJob = WorkerJob::Rank;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let locale = AppLocale::from_str(&input.default.locale);

        let avatar_asset = get_profile_icon(input.default.profile_icon_id).await?;
        let avatar_path = asset_path(&avatar_asset).await?;

        let mut resolved_ranks = Vec::new();
        for rank_entry in input.ranks {
            let rank_asset = get_rank_asset(&Rank::from(&rank_entry.tier));
            let rank_path = asset_path(&rank_asset).await?;
            resolved_ranks.push((rank_entry, rank_path));
        }

        let mut avatar_sprite = Sprite::from_path(&avatar_path.to_string_lossy(), 0, 16);
        avatar_sprite.resize_to_width(360);

        let level_background = Asset::new(AssetType::Other, "level.png");
        let mut level_background = Sprite::from_asset(&level_background, 0, 0).await?;
        level_background.resize_to_width(120);

        let left_column = Container::new()
            .direction(FlexDirection::Column)
            .align_items(AlignItems::Center)
            .gap(40)
            .x(80)
            .child(
                Container::new()
                    .direction(FlexDirection::Column)
                    .align_items(AlignItems::Center)
                    .child(
                        Label::new(locale.region(&input.default.region).to_ascii_uppercase())
                            .size(36)
                            .bold(),
                    )
                    .child(
                        Stack::new().child(level_background).child(
                            Label::new(input.default.level.to_string())
                                .size(42)
                                .bold()
                                .x(60)
                                .align(Alignment::Middle),
                        ),
                    ),
            )
            .child(avatar_sprite)
            .child(
                Label::new(format!(
                    "{}#{}",
                    input.default.game_name, input.default.tag_line
                ))
                .size(48)
                .bold(),
            );

        let mut ranks_row = Container::new()
            .direction(FlexDirection::Row)
            .justify(JustifyContent::Center)
            .gap(240);

        for (rank_entry, rank_path) in resolved_ranks {
            let mut rank_sprite = Sprite::from_path(&rank_path.to_string_lossy(), 0, 0);
            rank_sprite.resize_to_width(250);

            let total_games = rank_entry.wins + rank_entry.losses;
            let win_rate = if total_games > 0 {
                (rank_entry.wins as f32 / total_games as f32) * 100.0
            } else {
                0.0
            };

            ranks_row = ranks_row.child(
                Container::new()
                    .direction(FlexDirection::Column)
                    .align_items(AlignItems::Center)
                    .gap(4)
                    .child(
                        Label::new(locale.queue_label(&rank_entry.queue_type))
                            .size(50)
                            .bold(),
                    )
                    .child(
                        Label::new(format!(
                            "{} {}",
                            locale.tier_label(&rank_entry.tier),
                            rank_entry.rank
                        ))
                        .size(45)
                        .bold()
                        .color(rank_color(&rank_entry.tier)),
                    )
                    .child(rank_sprite)
                    .child(
                        Label::new(format!("{} LP", rank_entry.league_points))
                            .size(45)
                            .bold(),
                    )
                    .child(
                        Label::new(format!("WR: {:.2}%", win_rate))
                            .size(45)
                            .bold()
                            .color(Color::Green),
                    )
                    .child(
                        Label::new(format!("Wins - {}", rank_entry.wins))
                            .size(45)
                            .bold()
                            .color(Color::Green),
                    )
                    .child(
                        Label::new(format!("Losses - {}", rank_entry.losses))
                            .size(45)
                            .bold()
                            .color(Color::Red),
                    ),
            );
        }

        let canvas = MasterCanvas::from_asset(get_background_asset(), context.into())
            .await
            .with_layout(|root| {
                root.padding(10)
                    .direction(FlexDirection::Row)
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
    use super::*;

    #[tokio::test]
    async fn test_save() {
        crate::assert_task_save!(super::RankTask, "test_files/rank_single_solo.json");
    }

    #[tokio::test]
    async fn test_rank_single_solo() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_single_solo.json");
    }

    #[tokio::test]
    async fn test_rank_single_flex() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_single_flex.json");
    }

    #[tokio::test]
    async fn test_rank_multiple() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_multiple.json");
    }

    #[tokio::test]
    async fn test_rank_multiple_2() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_multiple_2.json");
    }

    #[tokio::test]
    async fn test_rank_empty() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_empty.json");
    }
}
