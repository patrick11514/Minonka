#[derive(Debug)]
pub enum TaskError {
    Json(serde_json::Error),
    Io(std::io::Error),
    Image(image::ImageError),
    UnknownJob(String),
    NotImplemented(&'static str),
    Runtime(String),
    Reqwest(reqwest::Error),
}

impl std::fmt::Display for TaskError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Json(err) => write!(f, "Invalid task payload: {err}"),
            Self::Io(err) => write!(f, "IO error: {err}"),
            Self::Image(err) => write!(f, "Image error: {err}"),
            Self::UnknownJob(job) => write!(f, "Unknown job '{job}'"),
            Self::NotImplemented(task) => write!(f, "Task '{task}' is not implemented yet"),
            Self::Runtime(message) => write!(f, "Runtime error: {message}"),
            Self::Reqwest(err) => write!(f, "Reqwest error: {err}"),
        }
    }
}

impl std::error::Error for TaskError {}

impl From<serde_json::Error> for TaskError {
    fn from(value: serde_json::Error) -> Self {
        Self::Json(value)
    }
}

impl From<std::io::Error> for TaskError {
    fn from(value: std::io::Error) -> Self {
        Self::Io(value)
    }
}

impl From<image::ImageError> for TaskError {
    fn from(value: image::ImageError) -> Self {
        Self::Image(value)
    }
}

impl From<reqwest::Error> for TaskError {
    fn from(value: reqwest::Error) -> Self {
        Self::Reqwest(value)
    }
}

pub type TaskResult<T> = Result<T, TaskError>;
