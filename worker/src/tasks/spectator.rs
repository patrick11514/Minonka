use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, WorkerJob},
};

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
    pub puuid: String,
    pub spell1_id: u32,
    pub spell2_id: u32,
    pub perks: SpectatorPerksInput,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SpectatorTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub queue_id: u32,
    pub game_length: u32,
    pub map_id: u32,
    pub participants: Vec<SpectatorParticipantInput>,
}

pub struct SpectatorTask;

impl Task for SpectatorTask {
    type Input = SpectatorTaskInput;

    const NAME: &'static str = "spectator";
    const JOB: WorkerJob = WorkerJob::Spectator;

    async fn run(_input: Self::Input, _context: AppContext) -> TaskResult<TaskOutcome> {
        todo!()
    }
}
