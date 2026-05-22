use std::collections::HashMap;

use ab_glyph::FontArc;

use crate::{
    context::font_registry::{FontRegistry, FontType},
    utils::assets::{Asset, AssetType, asset_path},
};

pub mod font_registry;

#[derive(Debug, Clone)]
pub struct AppContext {
    fonts: FontRegistry,
}

impl AppContext {
    pub async fn new() -> Self {
        let fonts = HashMap::from([
            (
                FontType::Regular,
                Self::load_font("beaufortforlolja-regular.ttf").await,
            ),
            (
                FontType::Bold,
                Self::load_font("beaufortforlolja-bold.ttf").await,
            ),
        ]);

        Self {
            fonts: FontRegistry::new(fonts),
        }
    }

    async fn load_font(name: &str) -> FontArc {
        let asset = Asset::new(AssetType::Fonts, name);
        let path = asset_path(&asset)
            .await
            .unwrap_or_else(|_| panic!("Failed to get path for font asset: {}", name));

        FontArc::try_from_vec(std::fs::read(path).expect("Failed to read font file"))
            .expect("Failed to load font")
    }
}

impl Into<FontRegistry> for AppContext {
    fn into(self) -> FontRegistry {
        self.fonts
    }
}
