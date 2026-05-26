use serde::de::DeserializeOwned;
use tracing::Instrument;
use ts_rs::TS;

use crate::{
    context::AppContext,
    draw::master_canvas::MasterCanvas,
    tasks::{
        error::TaskResult,
        types::{FileResult, WorkerJob},
    },
    utils::storage,
};

pub enum SaveStrategy {
    Temporary,
    Persistent { filename: String },
}

pub enum TaskOutcome {
    Render(MasterCanvas, SaveStrategy),
    Existing(FileResult),
}

pub trait Task {
    type Input: DeserializeOwned + TS;

    const NAME: &'static str;
    const JOB: WorkerJob;

    fn run(
        input: Self::Input,
        context: AppContext,
    ) -> impl std::future::Future<Output = TaskResult<TaskOutcome>> + Send;

    fn parse_input(payload: &str) -> TaskResult<Self::Input> {
        Ok(serde_json::from_str(payload)?)
    }

    fn run_from_json(
        payload: &str,
        context: AppContext,
    ) -> impl std::future::Future<Output = TaskResult<FileResult>> + Send {
        let span = tracing::info_span!("task_run", task = Self::NAME);

        async move {
            let input = Self::parse_input(payload)?;

            match Self::run(input, context).await? {
                TaskOutcome::Existing(file_result) => Ok(file_result),
                TaskOutcome::Render(canvas, strategy) => match strategy {
                    SaveStrategy::Temporary => storage::save_temp_canvas(canvas).await,
                    SaveStrategy::Persistent { filename } => {
                        storage::save_persistent_canvas(canvas, &filename).await
                    }
                },
            }
        }
        .instrument(span)
    }
}
