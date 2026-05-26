pub mod cherry_match;
pub mod error;
pub mod match_task;
pub mod rank;
pub mod spectator;
pub mod summoner;
pub mod task;
pub mod team;
pub mod types;

use crate::context::AppContext;
use tracing::instrument;

use self::cherry_match::CherryMatchTask;
use self::match_task::MatchTask;
use self::rank::RankTask;
use self::spectator::SpectatorTask;
use self::summoner::SummonerTask;
use self::task::Task;
use self::team::TeamTask;
use self::types::FileResult;

#[instrument(skip(payload, context), fields(job_name = %job_name))]
pub async fn dispatch(
    job_name: &str,
    payload: &str,
    context: AppContext,
) -> error::TaskResult<FileResult> {
    match job_name {
        CherryMatchTask::NAME => CherryMatchTask::run_from_json(payload, context).await,
        MatchTask::NAME => MatchTask::run_from_json(payload, context).await,
        RankTask::NAME => RankTask::run_from_json(payload, context).await,
        SpectatorTask::NAME => SpectatorTask::run_from_json(payload, context).await,
        SummonerTask::NAME => SummonerTask::run_from_json(payload, context).await,
        TeamTask::NAME => TeamTask::run_from_json(payload, context).await,
        _ => Err(error::TaskError::UnknownJob(job_name.to_string())),
    }
}
