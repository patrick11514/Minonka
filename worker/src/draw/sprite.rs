use image::{RgbaImage, imageops};

use crate::{
    context::font_registry::FontRegistry,
    draw::renderable::Renderable,
    tasks::error::{TaskError, TaskResult},
    utils::assets::Asset,
};

pub struct Sprite {
    image: RgbaImage,
    x: u32,
    y: u32,
}

impl Sprite {
    pub fn new(image: RgbaImage, x: u32, y: u32) -> Self {
        Self { image, x, y }
    }

    pub fn from_path(path: &str, x: u32, y: u32) -> Self {
        let image = image::open(path)
            .expect("Failed to open sprite image")
            .to_rgba8();
        Self::new(image, x, y)
    }

    pub fn from_path_checked(path: &str, x: u32, y: u32) -> Result<Self, image::ImageError> {
        let image = image::open(path)?.to_rgba8();
        Ok(Self::new(image, x, y))
    }

    pub async fn from_asset(asset: &Asset, x: u32, y: u32) -> TaskResult<Self> {
        let path = crate::utils::assets::asset_path(asset).await?;
        Ok(Self::from_path_checked(&path.to_string_lossy(), x, y)?)
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

    pub fn dimensions(&self) -> (u32, u32) {
        (self.image.width(), self.image.height())
    }

    pub fn into_image(self) -> RgbaImage {
        self.image
    }
}

impl Renderable for Sprite {
    fn render(&self, canvas: &mut RgbaImage, _fonts: &FontRegistry, offset_x: u32, offset_y: u32) {
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
