use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::tasks::{
    error::TaskResult,
    runtime,
    task::Task,
    types::{DefaultParametersInput, FileResult, WorkerJob},
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SummonerChallengeInput {
    pub challenge_id: u64,
    pub level: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
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

    fn run(input: Self::Input) -> TaskResult<FileResult> {
        let font = runtime::load_font_data()?;
        let lines = vec![
            format!(
                "Summoner: {}#{}",
                input.default.game_name, input.default.tag_line
            ),
            format!("Region: {}", input.default.region),
            format!(
                "Banner/Crest: {} / {} (prestige {})",
                input.banner, input.crest, input.prestige_crest
            ),
            format!("Title: {}", input.title_id.unwrap_or_else(|| "None".to_string())),
            format!(
                "Challenges: {} selected, {} total entries",
                input.challenges.len(),
                input.user_challenges.len()
            ),
        ];

        let canvas = runtime::build_summary_canvas("Summoner", &lines, &font)?;
        runtime::save_temp_canvas(canvas)
    }
}
