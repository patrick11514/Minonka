use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::tasks::{
    error::TaskResult,
    rank::RankQueueEntryInput,
    task::{Task, TaskOutcome},
    types::WorkerJob,
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct TeamMasteryInput {
    pub champion_id: u32,
    pub champion_level: u16,
    pub champion_points: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct TeamPlayerInput {
    pub puuid: String,
    pub position: String,
    pub role: String,
    pub profile_icon_id: u32,
    pub level: u32,
    pub highest_rank: Option<RankQueueEntryInput>,
    pub game_name: String,
    pub tag_line: String,
    pub masteries: Vec<TeamMasteryInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct TeamTaskInput {
    pub abbreviation: String,
    pub name: String,
    pub icon_id: u32,
    pub tier: u32,
    pub captain: String,
    pub players: Vec<TeamPlayerInput>,
    pub locale: String,
}

pub struct TeamTask;

impl Task for TeamTask {
    type Input = TeamTaskInput;

    const NAME: &'static str = "team";
    const JOB: WorkerJob = WorkerJob::Team;

    async fn run(_input: Self::Input, _context: AppContext) -> TaskResult<TaskOutcome> {
        todo!()
    }
}
