use crate::lib::draw::renderable::Renderable;

pub struct Container {
    x: u32,
    y: u32,
    children: Vec<Box<dyn Renderable>>,
}

impl Container {
    pub fn new(x: u32, y: u32) -> Self {
        Self {
            x,
            y,
            children: Vec::new(),
        }
    }

    pub fn add_child(&mut self, child: Box<dyn Renderable>) {
        self.children.push(child);
    }
}

impl Renderable for Container {
    fn render(
        &self,
        canvas: &mut image::RgbaImage,
        font: &ab_glyph::FontRef,
        offset_x: u32,
        offset_y: u32,
    ) {
        let new_offset_x = offset_x + self.x;
        let new_offset_y = offset_y + self.y;

        for child in &self.children {
            child.render(canvas, font, new_offset_x, new_offset_y);
        }
    }
}
