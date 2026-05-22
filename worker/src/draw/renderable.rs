use image::RgbaImage;

use crate::context::font_registry::FontRegistry;

pub trait Renderable: Send {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: u32, offset_y: u32);

    fn size(&self, fonts: &FontRegistry) -> (u32, u32);
}
