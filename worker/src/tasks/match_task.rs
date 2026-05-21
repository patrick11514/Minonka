use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::context::AppContext;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{MatchMetadataInput, WorkerJob},
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct MatchTaskInput {
    pub region: String,
    pub locale: String,
    pub my_puuid: String,
    pub metadata: MatchMetadataInput,
    #[ts(type = "Record<string, unknown>")]
    pub info: Value,
    pub lp_gain: Option<i32>,
}

pub struct MatchTask;

impl Task for MatchTask {
    type Input = MatchTaskInput;

    const NAME: &'static str = "match";
    const JOB: WorkerJob = WorkerJob::Match;

    async fn run(_input: Self::Input, _context: AppContext) -> TaskResult<TaskOutcome> {
        todo!()
    }
}
