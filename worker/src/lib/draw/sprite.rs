use image::{RgbaImage, imageops};

use crate::lib::draw::renderable::Renderable;

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
}

impl Renderable for Sprite {
    fn render(
        &self,
        canvas: &mut RgbaImage,
        _font: &ab_glyph::FontRef,
        offset_x: u32,
        offset_y: u32,
    ) {
        let new_offset_x = offset_x + self.x;
        let new_offset_y = offset_y + self.y;

        imageops::overlay(
            canvas,
            &self.image,
            new_offset_x as i64,
            new_offset_y as i64,
        );
    }
}
