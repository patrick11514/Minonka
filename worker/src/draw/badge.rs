use crate::context::font_registry::{FontRegistry, FontType};
use crate::draw::color::Color;
use crate::draw::renderable::Renderable;
use ab_glyph::PxScale;
use image::{Pixel, Rgba, RgbaImage};
use imageproc::drawing::{draw_text_mut, text_size};

pub struct Badge {
    text: String,
    text_size: u32,
    color: Color,
    bg_alpha: f32,
    border_radius: f32,
    padding_x: u32,
    padding_y: u32,
    x: i32,
    y: i32,
    bold: bool,
}

impl Badge {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            text_size: 16,
            color: Color::White,
            bg_alpha: 0.25,
            border_radius: 4.0,
            padding_x: 8,
            padding_y: 3,
            x: 0,
            y: 0,
            bold: true,
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

    pub fn bg_alpha(mut self, alpha: f32) -> Self {
        self.bg_alpha = alpha;
        self
    }

    pub fn border_radius(mut self, radius: f32) -> Self {
        self.border_radius = radius;
        self
    }

    pub fn padding(mut self, px: u32, py: u32) -> Self {
        self.padding_x = px;
        self.padding_y = py;
        self
    }

    pub fn x(mut self, x: i32) -> Self {
        self.x = x;
        self
    }

    pub fn y(mut self, y: i32) -> Self {
        self.y = y;
        self
    }

    pub fn bold(mut self, bold: bool) -> Self {
        self.bold = bold;
        self
    }
}

impl Renderable for Badge {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let (width, height) = self.size(fonts);
        if width == 0 || height == 0 {
            return;
        }

        let start_x = offset_x + self.x;
        let start_y = offset_y + self.y;

        let scale = PxScale {
            x: self.text_size as f32,
            y: self.text_size as f32,
        };

        let font = if self.bold {
            fonts.get(FontType::Bold)
        } else {
            fonts.get(FontType::Regular)
        };

        let border_rgba = self.color.to_rgba();
        let bg_r = (border_rgba[0] as f32 * 0.15) as u8;
        let bg_g = (border_rgba[1] as f32 * 0.15) as u8;
        let bg_b = (border_rgba[2] as f32 * 0.15) as u8;
        let bg_a = (self.bg_alpha * 255.0).clamp(0.0, 255.0) as u8;
        let bg_pixel = Rgba([bg_r, bg_g, bg_b, bg_a]);

        let radius = self
            .border_radius
            .min(width as f32 / 2.0)
            .min(height as f32 / 2.0);

        let canvas_w = canvas.width() as i32;
        let canvas_h = canvas.height() as i32;

        for local_y in 0..height as i32 {
            let target_y = start_y + local_y;
            if target_y < 0 || target_y >= canvas_h {
                continue;
            }

            for local_x in 0..width as i32 {
                let target_x = start_x + local_x;
                if target_x < 0 || target_x >= canvas_w {
                    continue;
                }

                let px = local_x as f32 + 0.5;
                let py = local_y as f32 + 0.5;

                let cx = if px < radius {
                    radius
                } else if px > (width as f32 - radius) {
                    width as f32 - radius
                } else {
                    px
                };

                let cy = if py < radius {
                    radius
                } else if py > (height as f32 - radius) {
                    height as f32 - radius
                } else {
                    py
                };

                let dx = px - cx;
                let dy = py - cy;
                let dist = (dx * dx + dy * dy).sqrt();

                if dist > radius {
                    continue;
                }

                let is_border = local_x == 0
                    || local_x == width as i32 - 1
                    || local_y == 0
                    || local_y == height as i32 - 1
                    || (radius > 0.0 && dist >= radius - 1.0);

                let pixel_to_blend = if is_border {
                    border_rgba
                } else {
                    bg_pixel
                };

                let bg = canvas.get_pixel_mut(target_x as u32, target_y as u32);
                bg.blend(&pixel_to_blend);
            }
        }

        // Draw centered text
        let text_x = start_x + self.padding_x as i32;
        let text_y = start_y + self.padding_y as i32;

        draw_text_mut(
            canvas,
            border_rgba,
            text_x,
            text_y,
            scale,
            font,
            &self.text,
        );
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let font = if self.bold {
            fonts.get(FontType::Bold)
        } else {
            fonts.get(FontType::Regular)
        };
        let (tw, th) = text_size(
            PxScale {
                x: self.text_size as f32,
                y: self.text_size as f32,
            },
            font,
            &self.text,
        );
        (tw + self.padding_x * 2, th + self.padding_y * 2)
    }
}
