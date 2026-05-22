use crate::context::font_registry::FontRegistry;
use crate::draw::{container::Container, renderable::Renderable};
use crate::utils::assets::{Asset, asset_path};
use image::DynamicImage;
use image::RgbaImage;
use std::io::Cursor;

pub struct MasterCanvas {
    pub background: RgbaImage,
    pub container: Container,
    fonts: FontRegistry,
}

impl MasterCanvas {
    pub fn new(background: RgbaImage, fonts: FontRegistry) -> Self {
        // Automatically tie the root layout boundaries to the physical asset size
        let (w, h) = (background.width(), background.height());

        Self {
            background,
            container: Container::new().width(w).height(h),
            fonts,
        }
    }

    pub fn from_path(path: &str, fonts: FontRegistry) -> Self {
        let background = image::open(path)
            .expect("Failed to open background image")
            .to_rgba8();
        Self::new(background, fonts)
    }

    pub async fn from_asset(asset: Asset, fonts: FontRegistry) -> Self {
        let path = asset_path(&asset).await.expect("Failed to get asset path");
        let background = image::open(&path)
            .expect("Failed to open background image")
            .to_rgba8();
        Self::new(background, fonts)
    }

    /// Fluently configures the automatically sized root container via a builder closure.
    pub fn with_layout(mut self, configurator: impl FnOnce(Container) -> Container) -> Self {
        self.container = configurator(self.container);
        self
    }

    pub fn render(&mut self) {
        self.container
            .render(&mut self.background, &self.fonts, 0, 0);
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
