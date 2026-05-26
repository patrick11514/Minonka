use crate::{context::font_registry::FontRegistry, draw::renderable::Renderable};
use image::RgbaImage;

#[derive(Default, Clone, Copy, Debug)]
pub struct Padding {
    pub left: u32,
    pub top: u32,
    pub right: u32,
    pub bottom: u32,
}

impl Padding {
    pub fn zero() -> Self {
        Self {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        }
    }
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

#[derive(Default, Clone, Copy)]
pub enum AlignItems {
    #[default]
    Start,
    Center,
}

pub struct Container {
    x: u32,
    y: u32,
    children: Vec<Box<dyn Renderable>>,
    width: Option<u32>,
    height: Option<u32>,
    direction: FlexDirection,
    justify: JustifyContent,
    align_items: AlignItems,
    gap: u32,
    splits: Vec<u32>,
    padding: Padding,
}

impl Container {
    pub fn new() -> Self {
        Self {
            x: 0,
            y: 0,
            width: None,
            height: None,
            direction: FlexDirection::Row,
            justify: JustifyContent::Start,
            align_items: AlignItems::Start,
            gap: 0,
            children: Vec::new(),
            splits: Vec::new(),
            padding: Padding::zero(),
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
    pub fn size(mut self, dimensions: (u32, u32)) -> Self {
        self.width = Some(dimensions.0);
        self.height = Some(dimensions.1);
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
    pub fn align_items(mut self, align: AlignItems) -> Self {
        self.align_items = align;
        self
    }
    pub fn gap(mut self, g: u32) -> Self {
        self.gap = g;
        self
    }
    pub fn splits(mut self, splits: Vec<u32>) -> Self {
        self.splits = splits;
        self
    }

    /// Shorthand for 1 value: padding from all sides
    pub fn padding(mut self, all: u32) -> Self {
        self.padding = Padding {
            left: all,
            top: all,
            right: all,
            bottom: all,
        };
        self
    }

    /// Shorthand for 2 values: horizontal (left/right) and vertical (top/bottom)
    pub fn padding_xy(mut self, horizontal: u32, vertical: u32) -> Self {
        self.padding = Padding {
            left: horizontal,
            top: vertical,
            right: horizontal,
            bottom: vertical,
        };
        self
    }

    /// Shorthand for 4 values: explicit layout sequence (Left -> Top -> Right -> Bottom)
    pub fn padding_ltrb(mut self, left: u32, top: u32, right: u32, bottom: u32) -> Self {
        self.padding = Padding {
            left,
            top,
            right,
            bottom,
        };
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

    pub fn childs(mut self, children: Vec<impl Renderable + 'static>) -> Self {
        for child in children {
            self.children.push(Box::new(child));
        }
        self
    }

    pub fn childs_if(mut self, children: Vec<Option<impl Renderable + 'static>>) -> Self {
        for child in children {
            if let Some(child) = child {
                self.children.push(Box::new(child));
            }
        }

        self
    }

    fn calculate_content_size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let mut content_w = 0;
        let mut content_h = 0;

        for child in &self.children {
            let (cw, ch) = child.size(fonts);

            match self.direction {
                FlexDirection::Row => {
                    content_w += cw;
                    content_h = content_h.max(ch);
                }
                FlexDirection::Column => {
                    content_w = content_w.max(cw);
                    content_h += ch;
                }
            }
        }

        if !self.children.is_empty() {
            let total_gaps = (self.children.len() as u32 - 1) * self.gap;
            match self.direction {
                FlexDirection::Row => content_w += total_gaps,
                FlexDirection::Column => content_h += total_gaps,
            }
        }

        (content_w, content_h)
    }
}

impl Renderable for Container {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        let (total_w, total_h) = self.size(fonts);
        let (content_w, content_h) = self.calculate_content_size(fonts);

        // Derive inner viewport tracking bounds by slicing off the padding values
        let inner_w = total_w.saturating_sub(self.padding.left + self.padding.right);
        let inner_h = total_h.saturating_sub(self.padding.top + self.padding.bottom);

        // Advance start positions to accommodate internal padding gutters
        let mut cursor_x = offset_x + self.x as i32 + self.padding.left as i32;
        let mut cursor_y = offset_y + self.y as i32 + self.padding.top as i32;

        let num_children = self.children.len();
        let total_gaps = (num_children as u32).saturating_sub(1) * self.gap;

        if self.splits.is_empty() {
            match self.direction {
                FlexDirection::Row => {
                    if matches!(self.justify, JustifyContent::Center) && inner_w > content_w {
                        cursor_x += ((inner_w - content_w) / 2) as i32;
                    }
                }
                FlexDirection::Column => {
                    if matches!(self.justify, JustifyContent::Center) && inner_h > content_h {
                        cursor_y += ((inner_h - content_h) / 2) as i32;
                    }
                }
            }
        }

        for (i, child) in self.children.iter().enumerate() {
            let (cw, ch) = child.size(fonts);

            let mut cell_w = cw;
            let mut cell_h = ch;
            let mut cell_align_x = 0;
            let mut cell_align_y = 0;

            if !self.splits.is_empty() && i < self.splits.len() {
                match self.direction {
                    FlexDirection::Row => {
                        let available_w = inner_w.saturating_sub(total_gaps);
                        cell_w = (available_w * self.splits[i]) / 100;
                        if cell_w > cw {
                            cell_align_x = (cell_w - cw) / 2;
                        }
                    }
                    FlexDirection::Column => {
                        let available_h = inner_h.saturating_sub(total_gaps);
                        cell_h = (available_h * self.splits[i]) / 100;
                        if cell_h > ch {
                            cell_align_y = (cell_h - ch) / 2;
                        }
                    }
                }
            }

            let mut cross_offset_x = 0;
            let mut cross_offset_y = 0;

            match self.direction {
                FlexDirection::Row => {
                    if matches!(self.align_items, AlignItems::Center) && inner_h > ch {
                        cross_offset_y = (inner_h - ch) / 2;
                    }
                }
                FlexDirection::Column => {
                    if matches!(self.align_items, AlignItems::Center) && inner_w > cw {
                        cross_offset_x = (inner_w - cw) / 2;
                    }
                }
            }

            let current_gap = if self.splits.is_empty()
                && matches!(self.justify, JustifyContent::SpaceBetween)
                && num_children > 1
            {
                let raw_content_w = content_w.saturating_sub(total_gaps);
                let raw_content_h = content_h.saturating_sub(total_gaps);

                match self.direction {
                    FlexDirection::Row => {
                        (inner_w.saturating_sub(raw_content_w)) / (num_children as u32 - 1)
                    }
                    FlexDirection::Column => {
                        (inner_h.saturating_sub(raw_content_h)) / (num_children as u32 - 1)
                    }
                }
            } else {
                self.gap
            };

            child.render(
                canvas,
                fonts,
                cursor_x + (cross_offset_x + cell_align_x) as i32,
                cursor_y + (cross_offset_y + cell_align_y) as i32,
            );

            if i < num_children - 1 {
                match self.direction {
                    FlexDirection::Row => cursor_x += (cell_w + current_gap) as i32,
                    FlexDirection::Column => cursor_y += (cell_h + current_gap) as i32,
                }
            }
        }
    }

    fn size(&self, fonts: &FontRegistry) -> (u32, u32) {
        let (content_w, content_h) = self.calculate_content_size(fonts);
        (
            self.width
                .unwrap_or(content_w + self.padding.left + self.padding.right),
            self.height
                .unwrap_or(content_h + self.padding.top + self.padding.bottom),
        )
    }
}
