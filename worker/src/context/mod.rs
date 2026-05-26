use std::collections::HashMap;

use ab_glyph::FontArc;

use crate::{
    context::font_registry::{FontRegistry, FontType},
    tasks::error::{TaskError, TaskResult},
    utils::{
        ddragon_cache,
        {
            assets::{Asset, AssetType, asset_path},
            ddragon_cache,
        },
    },
};

pub mod font_registry;

/// AppContext is cloned on each job, the inside objects should be
/// simple to clone, to for heavy objects, use Arc inside.
///
/// Don't forget to implement Into<T> for any field inside for
/// easy access in tasks. (beacuse in future the job might accept
/// From<AppContext> instead of AppContext directly)
#[derive(Debug, Clone)]
pub struct AppContext {
    fonts: FontRegistry,
    ddragon_cache: ddragon_cache::DdragonCache,
}

impl AppContext {
    pub async fn new() -> TaskResult<Self> {
        let regular_font = Self::load_font("beaufortforlolja-regular.ttf").await?;
        let bold_font = Self::load_font("beaufortforlolja-bold.ttf").await?;

        let fonts = HashMap::from([
            (FontType::Regular, regular_font),
            (FontType::Bold, bold_font),
        ]);

        Ok(Self {
            fonts: FontRegistry::new(fonts),
            ddragon_cache: ddragon_cache::DdragonCache::new(),
            ddragon_cache: ddragon_cache::DdragonCache::new(),
        })
    }

    async fn load_font(name: &str) -> TaskResult<FontArc> {
        let asset = Asset::new(AssetType::Fonts, name);
        let path = asset_path(&asset).await.map_err(|err| {
            TaskError::Runtime(format!("Failed to get path for font asset {name}: {err}"))
        })?;

        let bytes = std::fs::read(&path).map_err(|err| {
            TaskError::Runtime(format!("Failed to read font file {path:?}: {err}"))
        })?;

        FontArc::try_from_vec(bytes)
            .map_err(|err| TaskError::Runtime(format!("Failed to load font {path:?}: {err}")))
    }
}

impl Into<FontRegistry> for AppContext {
    fn into(self) -> FontRegistry {
        self.fonts
    }
}

impl Into<ddragon_cache::DdragonCache> for AppContext {
    fn into(self) -> ddragon_cache::DdragonCache {
        self.ddragon_cache
    }
}
