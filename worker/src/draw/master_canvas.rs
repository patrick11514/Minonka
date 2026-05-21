use crate::draw::{container::Container, renderable::Renderable};
use crate::utils::assets::{Asset, asset_path};
use ab_glyph::Font;
use ab_glyph::FontArc;
use ab_glyph::FontRef;
use image::DynamicImage;
use image::RgbaImage;
use std::io::Cursor;

pub struct MasterCanvas {
    pub background: RgbaImage,
    pub container: Container,
    font: FontArc,
}

impl MasterCanvas {
    pub fn new(background: RgbaImage, font: FontArc) -> Self {
        Self {
            background,
            container: Container::new(),
            font,
        }
    }

    pub fn from_path(path: &str, font: FontArc) -> Self {
        let background = image::open(path)
            .expect("Failed to open background image")
            .to_rgba8();
        Self::new(background, font)
    }

    pub async fn from_asset(asset: Asset, font: FontArc) -> Self {
        println!("Loading background asset: {:?}", asset);

        let path = asset_path(&asset).await.expect("Failed to get asset path");

        println!("Background asset path: {:?}", path);

        let background = image::open(&path)
            .expect("Failed to open background image")
            .to_rgba8();
        Self::new(background, font)
    }

    pub fn render(&mut self) {
        let font_data = self.font.font_data();
        let font = FontRef::try_from_slice(font_data).expect("Failed to load font");

        self.container.render(&mut self.background, &font, 0, 0);
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
