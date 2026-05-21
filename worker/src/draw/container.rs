use crate::draw::renderable::Renderable;

pub struct Container {
    x: u32,
    y: u32,
    children: Vec<Box<dyn Renderable>>,
    width: Option<u32>,
    height: Option<u32>,
    direction: FlexDirection,
    justify: JustifyContent,
    gap: u32,
}

#[derive(Default, Clone, Copy)]
pub enum FlexDirection {
    #[default]
    Row,
    Column,
}

#[derive(Default, Clone, Copy)]
pub enum JustifyContent {
    #[default]
    Start,
    Center,
    SpaceBetween,
}

impl Container {
    // Start with a blank, shrink-wrapped Row at 0,0
    pub fn new() -> Self {
        Self {
            x: 0,
            y: 0,
            width: None,
            height: None,
            direction: FlexDirection::Row,
            justify: JustifyContent::Start,
            gap: 0,
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
    pub fn width(mut self, w: u32) -> Self {
        self.width = Some(w);
        self
    }
    pub fn height(mut self, h: u32) -> Self {
        self.height = Some(h);
        self
    }
    pub fn direction(mut self, dir: FlexDirection) -> Self {
        self.direction = dir;
        self
    }
    pub fn justify(mut self, j: JustifyContent) -> Self {
        self.justify = j;
        self
    }
    pub fn gap(mut self, g: u32) -> Self {
        self.gap = g;
        self
    }

    pub fn child(&mut self, child: impl Renderable + 'static) {
        self.children.push(Box::new(child));
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

    fn size(&self, font: &ab_glyph::FontRef) -> (u32, u32) {
        let mut calc_width = 0;
        let mut calc_height = 0;

        for child in &self.children {
            let (cw, ch) = child.size(font);

            match self.direction {
                FlexDirection::Row => {
                    calc_width += cw;
                    calc_height = calc_height.max(ch);
                }
                FlexDirection::Column => {
                    calc_width = calc_width.max(cw);
                    calc_height += ch;
                }
            }
        }

        if !self.children.is_empty() {
            let total_gaps = (self.children.len() as u32 - 1) * self.gap;
            match self.direction {
                FlexDirection::Row => calc_width += total_gaps,
                FlexDirection::Column => calc_height += total_gaps,
            }
        }

        (
            self.width.unwrap_or(calc_width),
            self.height.unwrap_or(calc_height),
        )
    }
}
