use std::{collections::HashMap, hash::Hash};

use ab_glyph::FontArc;

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub enum FontType {
    Regular,
    Bold,
}

pub type Fonts = HashMap<FontType, FontArc>;

#[derive(Debug, Clone)]
pub struct FontRegistry {
    fonts: Fonts,
}

impl FontRegistry {
    pub fn new(fonts: Fonts) -> Self {
        Self { fonts }
    }

    pub fn get(&self, font_type: FontType) -> &FontArc {
        self.fonts
            .get(&font_type)
            .expect("Font not found in registry")
    }
}
