use ab_glyph::FontArc;

use crate::utils::assets::{Asset, AssetType, asset_path};

#[derive(Debug, Clone)]
pub struct AppContext {
    font: FontArc,
}

impl AppContext {
    pub async fn new() -> Self {
        let asset = Asset::new(AssetType::Fonts, "beaufortforlolja-regular.ttf");
        let path = asset_path(&asset)
            .await
            .expect("Failed to get font asset path");

        let data = tokio::fs::read(path)
            .await
            .expect("Failed to read font file");
        let font = FontArc::try_from_vec(data).expect("Failed to load font");

        Self { font }
    }
}

impl Into<FontArc> for AppContext {
    fn into(self) -> FontArc {
        self.font
    }
}
