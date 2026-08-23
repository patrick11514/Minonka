use crate::{
    context::font_registry::FontRegistry,
    draw::{
        color::Color,
        renderable::{AsRenderable, Renderable},
    },
};
use image::{Pixel, RgbaImage};

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
pub enum ContainerDirection {
    #[default]
    Row,
    RowReverse,
    Column,
    ColumnReverse,
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
    End,
}

pub struct Container {
    x: i32,
    y: i32,
    children: Vec<Box<dyn Renderable>>,
    width: Option<u32>,
    height: Option<u32>,
    direction: ContainerDirection,
    justify: JustifyContent,
    align_items: AlignItems,
    gap: u32,
    splits: Vec<u32>,
    padding: Padding,
    wrap: bool,
    max_items_per_line: Option<usize>,
    background: Option<Color>,
}

struct Line<'a> {
    children: Vec<&'a Box<dyn Renderable>>,
    width: u32,
    height: u32,
}

impl Container {
    pub fn new() -> Self {
        Self {
            x: 0,
            y: 0,
            width: None,
            height: None,
            direction: ContainerDirection::Row,
            justify: JustifyContent::Start,
            align_items: AlignItems::Start,
            gap: 0,
            children: Vec::new(),
            splits: Vec::new(),
            padding: Padding::zero(),
            wrap: false,
            max_items_per_line: None,
            background: None,
        }
    }

    pub fn background(mut self, color: Color) -> Self {
        self.background = Some(color);
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
    pub fn width_offset(mut self, offset: i32) -> Self {
        if offset < 0 {
            self.width = Some(
                self.width
                    .unwrap_or(0)
                    .saturating_sub(offset.unsigned_abs()),
            );
        } else {
            self.width = Some(self.width.unwrap_or(0).saturating_add(offset as u32));
        }
        self
    }
    pub fn width(mut self, w: u32) -> Self {
        self.width = Some(w);
        self
    }
    pub fn height_offset(mut self, offset: i32) -> Self {
        if offset < 0 {
            self.height = Some(
                self.height
                    .unwrap_or(0)
                    .saturating_sub(offset.unsigned_abs()),
            );
        } else {
            self.height = Some(self.height.unwrap_or(0).saturating_add(offset as u32));
        }
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
    pub fn direction(mut self, dir: ContainerDirection) -> Self {
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
    pub fn reverse(mut self) -> Self {
        self.direction = match self.direction {
            ContainerDirection::Row => ContainerDirection::RowReverse,
            ContainerDirection::RowReverse => ContainerDirection::Row,
            ContainerDirection::Column => ContainerDirection::ColumnReverse,
            ContainerDirection::ColumnReverse => ContainerDirection::Column,
        };
        self
    }

    pub fn reverse_if(self, condition: bool) -> Self {
        if condition { self.reverse() } else { self }
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
    pub fn child(mut self, child: impl AsRenderable) -> Self {
        self.children.push(child.as_renderable());
        self
    }

    pub fn child_if(mut self, child: Option<impl AsRenderable>) -> Self {
        if let Some(child) = child {
            self.children.push(child.as_renderable());
        }
        self
    }

    pub fn childs(mut self, children: impl IntoIterator<Item = impl AsRenderable>) -> Self {
        for child in children {
            self.children.push(child.as_renderable());
        }
        self
    }

    pub fn childs_if(
        mut self,
        children: impl IntoIterator<Item = Option<impl AsRenderable>>,
    ) -> Self {
        for child in children {
            if let Some(child) = child {
                self.children.push(child.as_renderable());
            }
        }

        self
    }

    fn calculate_content_size(&self, fonts: &FontRegistry) -> (u32, u32) {
        // Determine the available bounding space for wrapping thresholds
        let inner_max_w = self
            .width
            .unwrap_or(u32::MAX)
            .saturating_sub(self.padding.left + self.padding.right);

        // Only wrap on Row setups; Column layouts stack natively along the y-axis anyway
        if matches!(
            self.direction,
            ContainerDirection::Row | ContainerDirection::RowReverse
        ) {
            let lines = self.pack_lines(fonts, inner_max_w);

            let mut total_w = 0;
            let mut total_h = 0;

            for line in &lines {
                total_w = total_w.max(line.width);
                total_h += line.height;
            }

            if !lines.is_empty() {
                total_h += (lines.len() as u32 - 1) * self.gap; // Account for gaps between wrapped rows
            }

            (total_w, total_h)
        } else {
            // Fall back to your legacy cross-axis tracking if it's a Column
            let mut content_w = 0;
            let mut content_h = 0;
            for child in &self.children {
                let (cw, ch) = child.size(fonts);
                content_w = content_w.max(cw);
                content_h += ch;
            }
            if !self.children.is_empty() {
                content_h += (self.children.len() as u32 - 1) * self.gap;
            }
            (content_w, content_h)
        }
    }

    pub fn wrap(mut self, wrap: bool) -> Self {
        self.wrap = wrap;
        self
    }

    pub fn max_items_per_line(mut self, count: usize) -> Self {
        self.max_items_per_line = Some(count);
        self
    }

    fn pack_lines(&self, fonts: &FontRegistry, max_width: u32) -> Vec<Line<'_>> {
        let mut lines = Vec::new();
        let mut current_line = Line {
            children: Vec::new(),
            width: 0,
            height: 0,
        };

        for child in &self.children {
            let (cw, ch) = child.size(fonts);

            // Check wrapping conditions
            let count_exceeded = self
                .max_items_per_line
                .map_or(false, |max| current_line.children.len() >= max);

            let width_exceeded = self.wrap
                && !current_line.children.is_empty()
                && (current_line.width + self.gap + cw > max_width);

            if count_exceeded || width_exceeded {
                // Push current line and start a new one
                lines.push(current_line);
                current_line = Line {
                    children: Vec::new(),
                    width: 0,
                    height: 0,
                };
            }

            // Append item stats to the line track
            if current_line.children.is_empty() {
                current_line.width = cw;
            } else {
                current_line.width += self.gap + cw;
            }
            current_line.height = current_line.height.max(ch);
            current_line.children.push(child);
        }

        if !current_line.children.is_empty() {
            lines.push(current_line);
        }

        lines
    }

    pub fn dimensions(&self, fonts: &FontRegistry) -> (u32, u32) {
        self.size(fonts)
    }
}

impl Renderable for Container {
    fn render(&self, canvas: &mut RgbaImage, fonts: &FontRegistry, offset_x: i32, offset_y: i32) {
        if let Some(bg) = self.background {
            let (total_w, total_h) = self.size(fonts);
            let start_x = (offset_x + self.x).max(0) as u32;
            let start_y = (offset_y + self.y).max(0) as u32;
            let end_x = ((offset_x + self.x) + total_w as i32)
                .min(canvas.width() as i32)
                .max(0) as u32;
            let end_y = ((offset_y + self.y) + total_h as i32)
                .min(canvas.height() as i32)
                .max(0) as u32;
            let rgba = bg.to_rgba();
            for y in start_y..end_y {
                for x in start_x..end_x {
                    canvas.get_pixel_mut(x, y).blend(&rgba);
                }
            }
        }

        if matches!(
            self.direction,
            ContainerDirection::Column | ContainerDirection::ColumnReverse
        ) || !self.wrap && self.max_items_per_line.is_none()
        {
            let (total_w, total_h) = self.size(fonts);
            let (content_w, content_h) = self.calculate_content_size(fonts);

            // Derive inner viewport tracking bounds by slicing off the padding values
            let inner_w = total_w.saturating_sub(self.padding.left + self.padding.right);
            let inner_h = total_h.saturating_sub(self.padding.top + self.padding.bottom);

            // Advance start positions to accommodate internal padding gutters
            let mut cursor_x = offset_x + self.x + self.padding.left as i32;
            let mut cursor_y = offset_y + self.y + self.padding.top as i32;

            // If reversing, anchor the cursor to the opposing inner gutter wall
            if matches!(self.direction, ContainerDirection::RowReverse) {
                cursor_x += inner_w as i32;
            }
            if matches!(self.direction, ContainerDirection::ColumnReverse) {
                cursor_y += inner_h as i32;
            }

            let num_children = self.children.len();
            let total_gaps = (num_children as u32).saturating_sub(1) * self.gap;

            // 1. FIX: Invert the layout shifting logic for Centered Justification
            if self.splits.is_empty() {
                match self.direction {
                    ContainerDirection::Row => {
                        if matches!(self.justify, JustifyContent::Center) && inner_w > content_w {
                            cursor_x += ((inner_w - content_w) / 2) as i32;
                        }
                    }
                    ContainerDirection::RowReverse => {
                        if matches!(self.justify, JustifyContent::Center) && inner_w > content_w {
                            cursor_x -= ((inner_w - content_w) / 2) as i32;
                        }
                    }
                    ContainerDirection::Column => {
                        if matches!(self.justify, JustifyContent::Center) && inner_h > content_h {
                            cursor_y += ((inner_h - content_h) / 2) as i32;
                        }
                    }
                    ContainerDirection::ColumnReverse => {
                        if matches!(self.justify, JustifyContent::Center) && inner_h > content_h {
                            cursor_y -= ((inner_h - content_h) / 2) as i32;
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

                // 2. FIX: Group Row/RowReverse and Column/ColumnReverse for custom cell splits
                if !self.splits.is_empty() && i < self.splits.len() {
                    match self.direction {
                        ContainerDirection::Row | ContainerDirection::RowReverse => {
                            let available_w = inner_w.saturating_sub(total_gaps);
                            cell_w = (available_w * self.splits[i]) / 100;
                            if cell_w > cw {
                                cell_align_x = (cell_w - cw) / 2;
                            }
                        }
                        ContainerDirection::Column | ContainerDirection::ColumnReverse => {
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

                // 3. Match cross-axis alignment for standard and reversed layout strategies
                match self.direction {
                    ContainerDirection::Row | ContainerDirection::RowReverse => {
                        if inner_h > ch {
                            match self.align_items {
                                AlignItems::Center => cross_offset_y = (inner_h - ch) / 2,
                                AlignItems::End => cross_offset_y = inner_h - ch,
                                AlignItems::Start => {}
                            }
                        }
                    }
                    ContainerDirection::Column | ContainerDirection::ColumnReverse => {
                        if inner_w > cw {
                            match self.align_items {
                                AlignItems::Center => cross_offset_x = (inner_w - cw) / 2,
                                AlignItems::End => cross_offset_x = inner_w - cw,
                                AlignItems::Start => {}
                            }
                        }
                    }
                }

                // 4. FIX: Handle Space-Between padding updates for reversed distributions
                let current_gap = if self.splits.is_empty()
                    && matches!(self.justify, JustifyContent::SpaceBetween)
                    && num_children > 1
                {
                    let raw_content_w = content_w.saturating_sub(total_gaps);
                    let raw_content_h = content_h.saturating_sub(total_gaps);

                    match self.direction {
                        ContainerDirection::Row | ContainerDirection::RowReverse => {
                            (inner_w.saturating_sub(raw_content_w)) / (num_children as u32 - 1)
                        }
                        ContainerDirection::Column | ContainerDirection::ColumnReverse => {
                            (inner_h.saturating_sub(raw_content_h)) / (num_children as u32 - 1)
                        }
                    }
                } else {
                    self.gap
                };

                let mut render_x = cursor_x + (cross_offset_x + cell_align_x) as i32;
                let mut render_y = cursor_y + (cross_offset_y + cell_align_y) as i32;

                // Offset the child backward into the viewport space
                if matches!(self.direction, ContainerDirection::RowReverse) {
                    render_x -= cell_w as i32;
                }
                if matches!(self.direction, ContainerDirection::ColumnReverse) {
                    render_y -= cell_h as i32;
                }

                child.render(canvas, fonts, render_x, render_y);

                if i < num_children - 1 {
                    match self.direction {
                        ContainerDirection::Row => cursor_x += (cell_w + current_gap) as i32,
                        ContainerDirection::RowReverse => cursor_x -= (cell_w + current_gap) as i32,
                        ContainerDirection::Column => cursor_y += (cell_h + current_gap) as i32,
                        ContainerDirection::ColumnReverse => {
                            cursor_y -= (cell_h + current_gap) as i32
                        }
                    }
                }
            }
            return;
        }

        let (total_w, _) = self.size(fonts);
        let inner_w = total_w.saturating_sub(self.padding.left + self.padding.right);

        let start_x = offset_x + self.x + self.padding.left as i32;
        let mut line_cursor_y = offset_y + self.y + self.padding.top as i32;

        let lines = self.pack_lines(fonts, inner_w);
        let is_reverse = matches!(self.direction, ContainerDirection::RowReverse);

        for line in lines {
            let num_line_children = line.children.len();
            let total_children_w: u32 = line.children.iter().map(|c| c.size(fonts).0).sum();

            let current_gap =
                if matches!(self.justify, JustifyContent::SpaceBetween) && num_line_children > 1 {
                    (inner_w.saturating_sub(total_children_w)) / (num_line_children as u32 - 1)
                } else {
                    self.gap
                };

            let line_w =
                if matches!(self.justify, JustifyContent::SpaceBetween) && num_line_children > 1 {
                    inner_w
                } else {
                    line.width
                };

            let mut item_cursor_x = if is_reverse {
                let mut x = start_x + inner_w as i32;
                if matches!(self.justify, JustifyContent::Center) && inner_w > line_w {
                    x -= ((inner_w - line_w) / 2) as i32;
                }
                x
            } else {
                let mut x = start_x;
                if matches!(self.justify, JustifyContent::Center) && inner_w > line_w {
                    x += ((inner_w - line_w) / 2) as i32;
                }
                x
            };

            for child in line.children {
                let (cw, ch) = child.size(fonts);
                let mut cross_offset_y = 0;

                // Handle cross-axis item alignment relative to its current line height
                if line.height > ch {
                    match self.align_items {
                        AlignItems::Center => cross_offset_y = (line.height - ch) / 2,
                        AlignItems::End => cross_offset_y = line.height - ch,
                        _ => {}
                    }
                }

                let render_x = if is_reverse {
                    item_cursor_x - cw as i32
                } else {
                    item_cursor_x
                };
                let render_y = line_cursor_y + cross_offset_y as i32;

                child.render(canvas, fonts, render_x, render_y);

                // Advance item cursor along the current line row
                if is_reverse {
                    item_cursor_x -= (cw + current_gap) as i32;
                } else {
                    item_cursor_x += (cw + current_gap) as i32;
                }
            }

            // Move line cursor down to allocate space for the next wrapped row
            line_cursor_y += (line.height + self.gap) as i32;
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
