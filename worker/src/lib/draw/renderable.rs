use ab_glyph::FontRef;
use image::RgbaImage;

pub trait Renderable {
    fn render(&self, canvas: &mut RgbaImage, font: &FontRef, offset_x: u32, offset_y: u32);
}
