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
pub struct SpectatorPerksInput {
    pub perk_ids: Vec<u32>,
    pub perk_style: u32,
    pub perk_sub_style: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
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
#[ts(export)]
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

    fn run(input: Self::Input) -> TaskResult<FileResult> {
        let font = runtime::load_font_data()?;
        let team_count = input
            .participants
            .iter()
            .map(|participant| participant.team_id)
            .collect::<std::collections::BTreeSet<_>>()
            .len();
        let lines = vec![
            format!(
                "Summoner: {}#{}",
                input.default.game_name, input.default.tag_line
            ),
            format!("Queue: {} | Map: {}", input.queue_id, input.map_id),
            format!("Game length: {}s", input.game_length),
            format!(
                "Participants: {} across {} teams",
                input.participants.len(),
                team_count
            ),
        ];

        let canvas = runtime::build_summary_canvas("Spectator", &lines, &font)?;
        runtime::save_temp_canvas(canvas)
    }
}
