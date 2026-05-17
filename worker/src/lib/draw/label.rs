use crate::lib::draw::color::Color;
use crate::lib::draw::renderable::Renderable;
use ab_glyph::{FontRef, PxScale};
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
}

impl Label {
    pub fn new(
        text: String,
        text_size: u32,
        color: Color,
        alignment: Alignment,
        x: u32,
        y: u32,
    ) -> Self {
        Self {
            text,
            text_size,
            color,
            alignment,
            x,
            y,
        }
    }
}

impl Renderable for Label {
    fn render(&self, canvas: &mut RgbaImage, font: &FontRef, offset_x: u32, offset_y: u32) {
        let scale = PxScale {
            x: self.text_size as f32,
            y: self.text_size as f32,
        };
        let rgba_color = self.color.to_rgba();

        let mut final_x = offset_x + self.x;
        let final_y = offset_y + self.y;

        match self.alignment {
            Alignment::Start => {}
            Alignment::Middle | Alignment::End => {
                let (w, _h) = text_size(scale, font, &self.text);
                if matches!(self.alignment, Alignment::Middle) {
                    final_x = final_x.saturating_sub(w / 2);
                } else {
                    final_x = final_x.saturating_sub(w);
                }
            }
        }

        draw_text_mut(
            canvas,
            rgba_color,
            final_x as i32,
            final_y as i32,
            scale,
            font,
            &self.text,
        );
    }
}
