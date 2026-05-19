use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::tasks::{
    error::TaskResult,
    rank::RankQueueEntryInput,
    runtime,
    task::Task,
    types::{FileResult, WorkerJob},
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TeamMasteryInput {
    pub champion_id: u32,
    pub champion_level: u16,
    pub champion_points: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
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
#[ts(export)]
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

    fn run(input: Self::Input) -> TaskResult<FileResult> {
        let font = runtime::load_font_data()?;
        let captain = input
            .players
            .iter()
            .find(|player| player.role == "CAPTAIN")
            .map(|player| format!("{}#{}", player.game_name, player.tag_line))
            .unwrap_or_else(|| "Unknown".to_string());

        let lines = vec![
            format!("Team: {} | {}", input.abbreviation, input.name),
            format!("Tier: {} | Icon: {}", input.tier, input.icon_id),
            format!("Captain: {captain}"),
            format!("Players: {}", input.players.len()),
        ];

        let canvas = runtime::build_summary_canvas("Clash Team", &lines, &font)?;
        runtime::save_temp_canvas(canvas)
    }
}
