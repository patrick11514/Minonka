use crate::context::font_registry::{FontRegistry, FontType};
use crate::draw::color::Color;
use crate::draw::renderable::Renderable;
use ab_glyph::PxScale;
use image::RgbaImage;
use imageproc::drawing::{draw_text_mut, text_size};

pub enum Alignment {
    Start,
    Middle,
    End,
}

pub struct Label {
    text: String,
    text_size: u32,
    color: Color,
    alignment: Alignment,
    x: u32,
    y: u32,
    bold: bool,
}

impl Label {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            text_size: 24,
            color: Color::White,
            alignment: Alignment::Start,
            x: 0,
            y: 0,
            bold: false,
        }
    }

    pub fn size(mut self, size: u32) -> Self {
        self.text_size = size;
        self
    }
    pub fn color(mut self, color: Color) -> Self {
        self.color = color;
        self
    }
    pub fn align(mut self, align: Alignment) -> Self {
        self.alignment = align;
        self
    }
    pub fn x(mut self, x: u32) -> Self {
        self.x = x;
        self
    }
    pub fn y(mut self, y: u32) -> Self {
        self.y = y;
        self
    }
    pub fn bold(mut self) -> Self {
        self.bold = true;
        self
    }
}

impl Renderable for Label {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let scale = PxScale {
            x: self.text_size as f32,
            y: self.text_size as f32,
        };
        let rgba_color = self.color.to_rgba();

        let mut final_x = offset_x + self.x as i32;
        let final_y = offset_y + self.y as i32;

        if !matches!(self.alignment, Alignment::Start) {
            let (w, _h) = text_size(
                scale,
                if self.bold {
                    fonts.get(FontType::Bold)
                } else {
                    fonts.get(FontType::Regular)
                },
                &self.text,
            );
            if matches!(self.alignment, Alignment::Middle) {
                final_x -= (w / 2) as i32;
            } else {
                final_x -= w as i32;
            }
        }

        draw_text_mut(
            canvas,
            rgba_color,
            final_x,
            final_y,
            scale,
            if self.bold {
                fonts.get(FontType::Bold)
            } else {
                fonts.get(FontType::Regular)
            },
            &self.text,
        );
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        imageproc::drawing::text_size(
            PxScale {
                x: self.text_size as f32,
                y: self.text_size as f32,
            },
            if self.bold {
                fonts.get(FontType::Bold)
            } else {
                fonts.get(FontType::Regular)
            },
            &self.text,
        )
    }
}
