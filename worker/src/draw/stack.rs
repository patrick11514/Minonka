use crate::{context::font_registry::FontRegistry, draw::renderable::Renderable};
use image::RgbaImage;

#[derive(Default, Clone, Copy, Debug)]
pub enum StackAlignment {
    #[default]
    TopLeft,
    Center,
}

pub struct Stack {
    x: i32,
    y: i32,
    width: Option<u32>,
    height: Option<u32>,
    alignment: StackAlignment,
    children: Vec<Box<dyn Renderable>>,
}

impl Stack {
    pub fn new() -> Self {
        Self {
            x: 0,
            y: 0,
            width: None,
            height: None,
            alignment: StackAlignment::TopLeft,
            children: Vec::new(),
        }
    }

    pub fn x(mut self, x: i32) -> Self {
        self.x = x;
        self
    }

    pub fn y(mut self, y: i32) -> Self {
        self.y = y;
        self
    }

    pub fn width(mut self, w: u32) -> Self {
        self.width = Some(w);
        self
    }

    pub fn height(mut self, h: u32) -> Self {
        self.height = Some(h);
        self
    }

    /// Ergonomic shorthand helper to unpack tuples like sprite.dimensions() instantly
    pub fn size(mut self, dimensions: (u32, u32)) -> Self {
        self.width = Some(dimensions.0);
        self.height = Some(dimensions.1);
        self
    }

    pub fn align_center(mut self) -> Self {
        self.alignment = StackAlignment::Center;
        self
    }

    pub fn child(mut self, child: impl Renderable + 'static) -> Self {
        self.children.push(Box::new(child));
        self
    }

    pub fn child_if(mut self, child: Option<impl Renderable + 'static>) -> Self {
        if let Some(child) = child {
            self.children.push(Box::new(child));
        }
        self
    }
}

impl Renderable for Stack {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let new_offset_x = offset_x + self.x;
        let new_offset_y = offset_y + self.y;

        let (total_w, total_h) = self.size(fonts);

        for child in &self.children {
            let mut child_offset_x = new_offset_x;
            let mut child_offset_y = new_offset_y;

            if matches!(self.alignment, StackAlignment::Center) {
                let (cw, ch) = child.size(fonts);

                // Casting to signed i32 allows this evaluation to cleanly yield negative values (e.g. -65)
                child_offset_x += (total_w as i32 - cw as i32) / 2;
                child_offset_y += (total_h as i32 - ch as i32) / 2;
            }

            child.render(canvas, fonts, child_offset_x, child_offset_y);
        }
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let mut max_w = 0;
        let mut max_h = 0;

        for child in &self.children {
            let (w, h) = child.size(fonts);
            max_w = max_w.max(w);
            max_h = max_h.max(h);
        }

        (self.width.unwrap_or(max_w), self.height.unwrap_or(max_h))
    }
}
