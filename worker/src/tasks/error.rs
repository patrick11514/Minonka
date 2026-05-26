#[derive(Debug)]
pub enum TaskError {
    Json(serde_json::Error),
    Io(std::io::Error),
    Image(image::ImageError),
    Context {
        operation: &'static str,
        target: String,
        source: Box<TaskError>,
    },
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
            Self::Context {
                operation,
                target,
                source,
            } => write!(f, "{operation} failed for {target}: {source}"),
            Self::UnknownJob(job) => write!(f, "Unknown job '{job}'"),
            Self::NotImplemented(task) => write!(f, "Task '{task}' is not implemented yet"),
            Self::Runtime(message) => write!(f, "Runtime error: {message}"),
            Self::Reqwest(err) => write!(f, "Reqwest error: {err}"),
        }
    }
}

impl std::error::Error for TaskError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::Json(err) => Some(err),
            Self::Io(err) => Some(err),
            Self::Image(err) => Some(err),
            Self::Context { source, .. } => Some(source.as_ref()),
            Self::Reqwest(err) => Some(err),
            Self::UnknownJob(_) | Self::NotImplemented(_) | Self::Runtime(_) => None,
        }
    }
}

impl TaskError {
    pub fn context(self, operation: &'static str, target: impl Into<String>) -> Self {
        Self::Context {
            operation,
            target: target.into(),
            source: Box::new(self),
        }
    }
}

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

pub trait TaskResultExt<T> {
    fn context(self, operation: &'static str, target: impl Into<String>) -> TaskResult<T>;
}

impl<T> TaskResultExt<T> for TaskResult<T> {
    fn context(self, operation: &'static str, target: impl Into<String>) -> TaskResult<T> {
        let target = target.into();
        self.map_err(|err| err.context(operation, target))
    }
}

pub fn format_error_chain(error: &dyn std::error::Error) -> String {
    let mut chain = Vec::new();
    chain.push(error.to_string());

    let mut source = error.source();
    while let Some(cause) = source {
        chain.push(cause.to_string());
        source = cause.source();
    }

    chain.join(" | caused by: ")
}

pub type TaskResult<T> = Result<T, TaskError>;
