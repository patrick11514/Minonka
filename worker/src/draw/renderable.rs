use image::RgbaImage;

use crate::context::font_registry::FontRegistry;

pub trait Renderable: Send {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32);

    fn size(&self, fonts: &FontRegistry) -> (u32, u32);
}
