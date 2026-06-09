use crate::context::font_registry::{FontRegistry, FontType};
use crate::draw::color::Color;
use crate::draw::renderable::Renderable;
use ab_glyph::PxScale;
use image::RgbaImage;
use imageproc::drawing::{draw_text_mut, text_size};

#[derive(Clone, Debug)]
pub struct TextSpan {
    pub text: String,
    pub color: Option<Color>,
    pub bold: Option<bool>,
    pub size: Option<u32>,
}

impl TextSpan {
    pub fn new(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            color: None,
            bold: None,
            size: None,
        }
    }

    pub fn color(mut self, color: Color) -> Self {
        self.color = Some(color);
        self
    }

    pub fn bold(mut self, bold: bool) -> Self {
        self.bold = Some(bold);
        self
    }

    pub fn size(mut self, size: u32) -> Self {
        self.size = Some(size);
        self
    }
}

pub struct RichLabel {
    spans: Vec<TextSpan>,
    text_size: u32,
    color: Color,
    bold: bool,
    x: i32,
    y: i32,
}

impl RichLabel {
    pub fn new() -> Self {
        Self {
            spans: Vec::new(),
            text_size: 24,
            color: Color::White,
            bold: false,
            x: 0,
            y: 0,
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

    pub fn bold(mut self) -> Self {
        self.bold = true;
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

    pub fn span(mut self, span: TextSpan) -> Self {
        self.spans.push(span);
        self
    }

    /// Add a plain text span that inherits all default styles from RichLabel
    pub fn text(mut self, text: impl Into<String>) -> Self {
        self.spans.push(TextSpan::new(text));
        self
    }

    /// Add a text span overriding only the color
    pub fn text_colored(mut self, text: impl Into<String>, color: Color) -> Self {
        self.spans.push(TextSpan::new(text).color(color));
        self
    }

    /// Add a text span overriding color and bold weight (can use either style or styled)
    pub fn text_style(mut self, text: impl Into<String>, color: Color, bold: bool) -> Self {
        self.spans.push(TextSpan::new(text).color(color).bold(bold));
        self
    }

    /// Alias for text_style
    pub fn text_styled(mut self, text: impl Into<String>, color: Color, bold: bool) -> Self {
        self.spans.push(TextSpan::new(text).color(color).bold(bold));
        self
    }

    /// Add a fully customized text span overriding size, color, and bold weight
    pub fn text_custom(
        mut self,
        text: impl Into<String>,
        color: Color,
        bold: bool,
        size: u32,
    ) -> Self {
        self.spans.push(TextSpan::new(text).color(color).bold(bold).size(size));
        self
    }
}

impl Renderable for RichLabel {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let mut current_x = offset_x + self.x;
        let final_y = offset_y + self.y;

        for span in &self.spans {
            if span.text.is_empty() {
                continue;
            }

            let span_size = span.size.unwrap_or(self.text_size);
            let scale = PxScale {
                x: span_size as f32,
                y: span_size as f32,
            };
            let rgba_color = span.color.unwrap_or(self.color).to_rgba();

            let span_bold = span.bold.unwrap_or(self.bold);
            let font = if span_bold {
                fonts.get(FontType::Bold)
            } else {
                fonts.get(FontType::Regular)
            };

            // Draw the span text
            draw_text_mut(canvas, rgba_color, current_x, final_y, scale, font, &span.text);

            // Advance cursor
            let (w, _h) = text_size(scale, font, &span.text);
            current_x += w as i32;
        }
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let mut total_width = 0;
        let mut max_height = 0;

        for span in &self.spans {
            if span.text.is_empty() {
                continue;
            }

            let span_size = span.size.unwrap_or(self.text_size);
            let scale = PxScale {
                x: span_size as f32,
                y: span_size as f32,
            };

            let span_bold = span.bold.unwrap_or(self.bold);
            let font = if span_bold {
                fonts.get(FontType::Bold)
            } else {
                fonts.get(FontType::Regular)
            };

            let (w, h) = text_size(scale, font, &span.text);
            total_width += w;
            max_height = max_height.max(h);
        }

        (total_width, max_height)
    }
}
