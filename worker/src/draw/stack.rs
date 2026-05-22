use crate::{context::font_registry::FontRegistry, draw::renderable::Renderable};
use image::RgbaImage;

pub struct Stack {
    x: u32,
    y: u32,
    children: Vec<Box<dyn Renderable>>,
}

impl Stack {
    pub fn new() -> Self {
        Self {
            x: 0,
            y: 0,
            children: Vec::new(),
        }
    }

    pub fn x(mut self, x: u32) -> Self {
        self.x = x;
        self
    }

    pub fn y(mut self, y: u32) -> Self {
        self.y = y;
        self
    }

    pub fn child(mut self, child: impl Renderable + 'static) -> Self {
        self.children.push(Box::new(child));
        self
    }
}

impl Renderable for Stack {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: u32, offset_y: u32) {
        let new_offset_x = offset_x + self.x;
        let new_offset_y = offset_y + self.y;

        for child in &self.children {
            child.render(canvas, fonts, new_offset_x, new_offset_y);
        }
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let mut max_w = 0;
        let mut max_h = 0;

        for child in &self.children {
            let (cw, ch) = child.size(fonts);
            max_w = max_w.max(cw);
            max_h = max_h.max(ch);
        }

        (max_w, max_h)
    }
}
