use crate::draw::{container::Container, renderable::Renderable};
use ab_glyph::FontRef;
use image::DynamicImage;
use image::RgbaImage;
use std::io::Cursor;

pub struct MasterCanvas<'a> {
    background: RgbaImage,
    pub container: Container,
    font: FontRef<'a>,
}

impl<'a> MasterCanvas<'a> {
    pub fn new(background: RgbaImage, font_data: &'a [u8]) -> Self {
        let font = FontRef::try_from_slice(font_data).expect("Failed to parse font data");
        Self {
            background,
            container: Container::new(0, 0),
            font,
        }
    }

    pub fn from_path(path: &str, font_data: &'a [u8]) -> Self {
        let background = image::open(path)
            .expect("Failed to open background image")
            .to_rgba8();
        Self::new(background, font_data)
    }

    pub fn render(&mut self) {
        self.container
            .render(&mut self.background, &self.font, 0, 0);
    }

    pub fn save(&self, path: &str) {
        self.background.save(path).unwrap();
    }

    pub fn save_checked(&self, path: &str) -> Result<(), image::ImageError> {
        self.background.save(path)
    }

    pub fn to_png_bytes(&self) -> Result<Vec<u8>, image::ImageError> {
        let mut bytes = Vec::new();
        let mut cursor = Cursor::new(&mut bytes);
        DynamicImage::ImageRgba8(self.background.clone())
            .write_to(&mut cursor, image::ImageFormat::Png)?;
        Ok(bytes)
    }

    pub fn dimensions(&self) -> (u32, u32) {
        (self.background.width(), self.background.height())
    }
}
