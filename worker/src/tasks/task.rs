use serde::de::DeserializeOwned;
use ts_rs::TS;

use crate::tasks::{
    error::TaskResult,
    types::{FileResult, WorkerJob},
};

pub trait Task {
    type Input: DeserializeOwned + TS;

    const NAME: &'static str;
    const JOB: WorkerJob;

    fn run(input: Self::Input) -> TaskResult<FileResult>;

    fn parse_input(payload: &str) -> TaskResult<Self::Input> {
        Ok(serde_json::from_str(payload)?)
    }

    fn run_from_json(payload: &str) -> TaskResult<FileResult> {
        let input = Self::parse_input(payload)?;
        Self::run(input)
    }
}
