use image::RgbaImage;

use crate::context::font_registry::FontRegistry;

pub trait Renderable: Send {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32);

    fn size(&self, fonts: &FontRegistry) -> (u32, u32);
}

pub trait AsRenderable {
    fn as_renderable(self) -> Box<dyn Renderable>;
}

impl AsRenderable for crate::draw::sprite::Sprite {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}
impl AsRenderable for crate::draw::label::Label {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}
impl AsRenderable for crate::draw::container::Container {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}
impl AsRenderable for crate::draw::stack::Stack {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}
impl AsRenderable for crate::draw::rich_label::RichLabel {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}
impl AsRenderable for crate::draw::badge::Badge {
    fn as_renderable(self) -> Box<dyn Renderable> {
        Box::new(self)
    }
}

impl AsRenderable for Box<dyn Renderable> {
    fn as_renderable(self) -> Box<dyn Renderable> {
        self
    }
}
