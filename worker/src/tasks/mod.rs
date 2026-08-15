pub mod cherry_match;
pub mod error;
pub mod graph;
pub mod match_task;
pub mod rank;
pub mod report;
pub mod spectator;
pub mod summoner;
pub mod task;
pub mod team;
pub mod types;

use crate::context::AppContext;
use tracing::error;
use tracing::instrument;

use self::cherry_match::CherryMatchTask;
use self::graph::GraphTask;
use self::match_task::MatchTask;
use self::rank::RankTask;
use self::report::ReportTask;
use self::spectator::SpectatorTask;
use self::summoner::SummonerTask;
use self::task::Task;
use self::team::TeamTask;
use self::types::FileResult;

#[instrument(skip(payload, context), fields(job_name = %job_name), err)]
pub async fn dispatch(
    job_name: &str,
    payload: &str,
    context: AppContext,
) -> error::TaskResult<FileResult> {
    let result = match job_name {
        CherryMatchTask::NAME => CherryMatchTask::run_from_json(payload, context).await,
        MatchTask::NAME => MatchTask::run_from_json(payload, context).await,
        RankTask::NAME => RankTask::run_from_json(payload, context).await,
        SpectatorTask::NAME => SpectatorTask::run_from_json(payload, context).await,
        SummonerTask::NAME => SummonerTask::run_from_json(payload, context).await,
        TeamTask::NAME => TeamTask::run_from_json(payload, context).await,
        GraphTask::NAME => GraphTask::run_from_json(payload, context).await,
        ReportTask::NAME => ReportTask::run_from_json(payload, context).await,
        _ => Err(error::TaskError::UnknownJob(job_name.to_string())),
    };

    if let Err(err) = &result {
        error!(
            job_name = %job_name,
            error = %err,
            error_chain = %error::format_error_chain(err),
            "task dispatch failed"
        );
    }

    result
}
