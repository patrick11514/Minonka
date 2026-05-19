use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use image::Rgba;
use image::RgbaImage;

use crate::draw::color::Color;
use crate::draw::label::{Alignment, Label};
use crate::draw::master_canvas::MasterCanvas;
use crate::tasks::error::{TaskError, TaskResult};
use crate::tasks::types::FileResult;

fn unique_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    format!("{:x}-{:x}", nanos, std::process::id())
}

pub fn resolve_existing(paths: &[&str]) -> Option<PathBuf> {
    paths
        .iter()
        .map(PathBuf::from)
        .find(|path| path.exists())
}

fn resolve_background_path() -> PathBuf {
    resolve_existing(&["assets/other/background.png", "../assets/other/background.png"]).unwrap_or_else(|| PathBuf::from("assets/other/background.png"))
}

fn resolve_font_path() -> PathBuf {
    resolve_existing(&[
        "assets/fonts/beaufortforlolja-regular.ttf",
        "../assets/fonts/beaufortforlolja-regular.ttf",
    ])
    .unwrap_or_else(|| PathBuf::from("assets/fonts/beaufortforlolja-regular.ttf"))
}

fn ensure_dir(path: &Path) -> TaskResult<()> {
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    Ok(())
}

pub fn build_summary_canvas<'a>(
    title: &str,
    lines: &[String],
    font_data: &'a [u8],
) -> TaskResult<MasterCanvas<'a>> {
    let background_path = resolve_background_path();

    let mut canvas = if background_path.exists() {
        MasterCanvas::from_path(background_path.to_string_lossy().as_ref(), font_data)
    } else {
        let image = RgbaImage::from_pixel(1920, 1080, Rgba([10, 10, 20, 255]));
        MasterCanvas::new(image, font_data)
    };

    canvas.container.add_child(Box::new(Label::new(
        title.to_string(),
        56,
        Color::White,
        Alignment::Middle,
        960,
        80,
    )));

    for (index, line) in lines.iter().enumerate() {
        canvas.container.add_child(Box::new(Label::new(
            line.clone(),
            34,
            Color::White,
            Alignment::Start,
            120,
            220 + (index as u32 * 54),
        )));
    }

    Ok(canvas)
}

pub fn load_font_data() -> TaskResult<Vec<u8>> {
    let font_path = resolve_font_path();
    Ok(fs::read(&font_path)?)
}

pub fn save_temp_canvas(mut canvas: MasterCanvas<'_>) -> TaskResult<FileResult> {
    canvas.render();

    let cache_path = std::env::var("CACHE_PATH").unwrap_or_else(|_| "/tmp".to_string());
    let cache_dir = PathBuf::from(cache_path);
    ensure_dir(&cache_dir)?;

    let file_path = cache_dir.join(format!("{}.png", unique_id()));
    canvas.save_checked(file_path.to_string_lossy().as_ref())?;

    Ok(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    })
}

pub fn save_persistent_canvas(
    mut canvas: MasterCanvas<'_>,
    image_name: &str,
) -> TaskResult<FileResult> {
    canvas.render();

    let persistent_path =
        std::env::var("PERSISTANT_CACHE_PATH").unwrap_or_else(|_| "cache".to_string());
    let persistent_dir = PathBuf::from(persistent_path);
    ensure_dir(&persistent_dir)?;

    let file_path = persistent_dir.join(image_name);
    canvas.save_checked(file_path.to_string_lossy().as_ref())?;

    Ok(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    })
}

pub fn get_persistent_result(image_name: &str) -> TaskResult<Option<FileResult>> {
    let persistent_path =
        std::env::var("PERSISTANT_CACHE_PATH").unwrap_or_else(|_| "cache".to_string());
    let file_path = PathBuf::from(persistent_path).join(image_name);

    if !file_path.exists() {
        return Ok(None);
    }

    Ok(Some(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    }))
}

pub fn required_text(value: &str, field: &str) -> TaskResult<String> {
    if value.is_empty() {
        return Err(TaskError::Runtime(format!("missing required field: {field}")));
    }
    Ok(value.to_string())
}
