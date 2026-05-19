pub mod cherry_match;
pub mod error;
pub mod match_task;
pub mod rank;
pub mod runtime;
pub mod spectator;
pub mod summoner;
pub mod task;
pub mod team;
pub mod types;

use self::cherry_match::CherryMatchTask;
use self::match_task::MatchTask;
use self::rank::RankTask;
use self::spectator::SpectatorTask;
use self::summoner::SummonerTask;
use self::task::Task;
use self::team::TeamTask;
use self::types::FileResult;

pub fn dispatch(job_name: &str, payload: &str) -> error::TaskResult<FileResult> {
	match job_name {
		CherryMatchTask::NAME => CherryMatchTask::run_from_json(payload),
		MatchTask::NAME => MatchTask::run_from_json(payload),
		RankTask::NAME => RankTask::run_from_json(payload),
		SpectatorTask::NAME => SpectatorTask::run_from_json(payload),
		SummonerTask::NAME => SummonerTask::run_from_json(payload),
		TeamTask::NAME => TeamTask::run_from_json(payload),
		_ => Err(error::TaskError::UnknownJob(job_name.to_string())),
	}
}
