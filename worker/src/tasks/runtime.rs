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

pub fn resolve_existing(paths: &[&str]) -> Option<PathBuf> {
    paths.iter().map(PathBuf::from).find(|path| path.exists())
}

fn resolve_background_path() -> PathBuf {
    resolve_existing(&[
        "assets/other/background.png",
        "../assets/other/background.png",
    ])
    .unwrap_or_else(|| PathBuf::from("assets/other/background.png"))
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

    canvas.container.child(
        Label::new(title.to_string())
            .size(56)
            .color(Color::White)
            .align(Alignment::Middle)
            .x(960)
            .y(80),
    );

    for (index, line) in lines.iter().enumerate() {
        canvas.container.child(
            Label::new(line.clone())
                .size(34)
                .color(Color::White)
                .align(Alignment::Start)
                .x(120)
                .y(220 + (index as u32 * 54)),
        );
    }

    Ok(canvas)
}

pub fn load_font_data() -> TaskResult<Vec<u8>> {
    let font_path = resolve_font_path();
    Ok(fs::read(&font_path)?)
}

pub fn required_text(value: &str, field: &str) -> TaskResult<String> {
    if value.is_empty() {
        return Err(TaskError::Runtime(format!(
            "missing required field: {field}"
        )));
    }
    Ok(value.to_string())
}
