use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

use crate::tasks::{
    error::TaskResult,
    runtime,
    task::Task,
    types::{FileResult, MatchMetadataInput, WorkerJob},
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

    fn run(input: Self::Input) -> TaskResult<FileResult> {
        let image_name = format!(
            "{}_{}_{}.png",
            input.metadata.match_id, input.my_puuid, input.locale
        );

        if let Some(existing) = runtime::get_persistent_result(&image_name)? {
            return Ok(existing);
        }

        let font = runtime::load_font_data()?;
        let queue_id = input
            .info
            .get("queueId")
            .and_then(|value| value.as_i64())
            .unwrap_or_default();
        let duration = input
            .info
            .get("gameDuration")
            .and_then(|value| value.as_i64())
            .unwrap_or_default();

        let lines = vec![
            format!("Match ID: {}", input.metadata.match_id),
            format!("Region: {} | Queue: {}", input.region, queue_id),
            format!("Duration: {}s", duration),
            format!(
                "LP Delta: {}",
                input
                    .lp_gain
                    .map_or_else(|| "Unknown".to_string(), |lp| lp.to_string())
            ),
        ];

        let canvas = runtime::build_summary_canvas("Match", &lines, &font)?;
        runtime::save_persistent_canvas(canvas, &image_name)
    }
}
