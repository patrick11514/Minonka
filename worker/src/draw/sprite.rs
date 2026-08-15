use image::{RgbaImage, imageops};

use crate::{
    context::font_registry::FontRegistry,
    draw::renderable::Renderable,
    tasks::error::{TaskError, TaskResult, TaskResultExt},
    utils::assets::Asset,
};

#[derive(Clone)]
pub struct Sprite {
    image: RgbaImage,
    x: i32,
    y: i32,
}

impl Sprite {
    pub fn new(image: RgbaImage, x: i32, y: i32) -> Self {
        Self { image, x, y }
    }

    #[tracing::instrument(fields(path = %path), err)]
    pub fn from_path(path: &str, x: i32, y: i32) -> TaskResult<Self> {
        let image = image::open(path)
            .map_err(TaskError::Image)
            .context("open sprite", path)?
            .to_rgba8();
        Ok(Self::new(image, x, y))
    }

    pub fn from_path_checked(path: &str, x: i32, y: i32) -> Result<Self, image::ImageError> {
        let image = image::open(path)?.to_rgba8();
        Ok(Self::new(image, x, y))
    }

    #[tracing::instrument(skip(asset), fields(asset = %asset.name, asset_type = ?asset.asset_type), err)]
    pub async fn from_asset(asset: &Asset, x: i32, y: i32) -> TaskResult<Self> {
        let path = crate::utils::assets::asset_path(asset)
            .await
            .context("resolve sprite asset path", asset.name.clone())?;
        let path_display = path.to_string_lossy().to_string();

        Ok(Self::from_path_checked(&path_display, x, y)
            .map_err(TaskError::Image)
            .context("open sprite", path_display)?)
    }

    pub fn resize_to_width(&mut self, width: u32) {
        if width == 0 {
            return;
        }

        let original_width = self.image.width();
        let original_height = self.image.height();
        if original_width == 0 || original_height == 0 {
            return;
        }

        let height = (original_height.saturating_mul(width) / original_width).max(1);
        self.image = imageops::resize(&self.image, width, height, imageops::FilterType::Lanczos3);
    }

    pub fn resize_to_height(&mut self, height: u32) {
        if height == 0 {
            return;
        }

        let original_width = self.image.width();
        let original_height = self.image.height();
        if original_width == 0 || original_height == 0 {
            return;
        }

        let width = (original_width.saturating_mul(height) / original_height).max(1);
        self.image = imageops::resize(&self.image, width, height, imageops::FilterType::Lanczos3);
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0 || height == 0 {
            return;
        }
        self.image = imageops::resize(&self.image, width, height, imageops::FilterType::Lanczos3);
    }

    pub fn rotate90(&mut self) {
        self.image = imageops::rotate90(&self.image);
    }

    pub fn dimensions(&self) -> (u32, u32) {
        (self.image.width(), self.image.height())
    }

    pub fn into_image(self) -> RgbaImage {
        self.image
    }

    pub fn roundify(&mut self, radius: f32) {
        let (width, height) = self.dimensions();
        if width == 0 || height == 0 || radius <= 0.0 {
            return;
        }

        // SVG automatically clamps the radius to half the width/height to prevent visual bugs.
        // We do the same here.
        let radius = radius.min(width as f32 / 2.0).min(height as f32 / 2.0);

        for (x, y, pixel) in self.image.enumerate_pixels_mut() {
            // Add 0.5 to measure from the center of the pixel
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;

            // Determine if the pixel is inside one of the 4 corner regions
            let cx = if px < radius {
                radius
            } else if px > (width as f32 - radius) {
                width as f32 - radius
            } else {
                continue; // Pixel is in a safe middle zone horizontally
            };

            let cy = if py < radius {
                radius
            } else if py > (height as f32 - radius) {
                height as f32 - radius
            } else {
                continue; // Pixel is in a safe middle zone vertically
            };

            // Calculate distance to the corner's radial center
            let dx = px - cx;
            let dy = py - cy;
            let distance = (dx * dx + dy * dy).sqrt();

            if distance > radius {
                // Pixel is completely outside the rounded corner
                pixel[3] = 0;
            } else if distance > radius - 1.0 {
                // Anti-aliasing: smooth out the jagged pixel edges along the curve
                let alpha_factor = radius - distance;
                pixel[3] = (pixel[3] as f32 * alpha_factor) as u8;
            }
        }
    }

    /// Helper method: Turns the sprite into a perfect circle
    /// (Extremely common for Profile Icons and Champion Portraits)
    pub fn roundify_circle(&mut self) {
        let (width, height) = self.dimensions();
        // A perfect circle's radius is half of the shortest side
        let max_radius = (width.min(height) as f32) / 2.0;
        self.roundify(max_radius);
    }

    pub fn x(mut self, x: i32) -> Self {
        self.x = x;
        self
    }

    pub fn y(mut self, y: i32) -> Self {
        self.y = y;
        self
    }
}

impl Renderable for Sprite {
    fn render(&self, canvas: &mut RgbaImage, _fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let new_offset_x = offset_x + self.x;
        let new_offset_y = offset_y + self.y;

        imageops::overlay(
            canvas,
            &self.image,
            new_offset_x as i64,
            new_offset_y as i64,
        );
    }

    fn size(&self, _fonts: &FontRegistry) -> (u32, u32) {
        (self.image.width(), self.image.height())
    }
}
