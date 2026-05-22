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
pub struct SummonerChallengeInput {
    pub challenge_id: u64,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct SummonerTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub title_id: Option<String>,
    pub crest: u32,
    pub prestige_crest: u32,
    pub banner: u32,
    pub challenges: Vec<u64>,
    pub user_challenges: Vec<SummonerChallengeInput>,
}

pub struct SummonerTask;

impl Task for SummonerTask {
    type Input = SummonerTaskInput;

    const NAME: &'static str = "summoner";
    const JOB: WorkerJob = WorkerJob::Summoner;

    async fn run(_input: Self::Input, _context: AppContext) -> TaskResult<TaskOutcome> {
        todo!()
    }
}
