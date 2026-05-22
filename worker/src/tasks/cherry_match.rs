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
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct CherryMatchTaskInput {
    pub region: String,
    pub locale: String,
    pub my_puuid: String,
    pub metadata: MatchMetadataInput,
    #[ts(type = "Record<string, unknown>")]
    pub info: Value,
}

pub struct CherryMatchTask;

impl Task for CherryMatchTask {
    type Input = CherryMatchTaskInput;

    const NAME: &'static str = "cherryMatch";
    const JOB: WorkerJob = WorkerJob::CherryMatch;

    async fn run(_input: Self::Input, _context: AppContext) -> TaskResult<TaskOutcome> {
        todo!()
    }
}
