use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::Container;
use crate::draw::label::{Alignment, Label};
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::tasks::task::SaveStrategy;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, FileResult, WorkerJob},
};
use crate::utils::assets::get_background_asset;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
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
#[ts(export)]
pub struct RankTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub ranks: Vec<RankQueueEntryInput>,
}

pub struct RankTask;

fn title_case(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    let lower = value.to_ascii_lowercase();
    let mut chars = lower.chars();
    let first = chars.next().unwrap_or_default().to_ascii_uppercase();
    format!("{first}{}", chars.collect::<String>())
}

fn queue_label(queue_type: &str) -> &'static str {
    match queue_type {
        "RANKED_SOLO_5x5" => "Ranked Solo/Duo",
        "RANKED_FLEX_SR" => "Ranked Flex",
        _ => "Ranked Queue",
    }
}

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
        let mut container = MasterCanvas::from_asset(get_background_asset(), context.into()).await;

        TaskResult::Ok(TaskOutcome::Render(container, SaveStrategy::Temporary))
    }
}

mod test {
    use super::*;

    #[tokio::test]
    async fn test_single_solo() {
        crate::assert_task_visual!(super::RankTask, "test_files/rank_single_solo.json");
    }
}
