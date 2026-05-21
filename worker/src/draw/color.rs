use image::Rgba;

#[derive(Debug, Clone, Copy)]
pub enum Color {
    Rgba(u8, u8, u8, u8),

    White,
    Black,
    Yellow,
    Green,
    Red,
}

impl Color {
    #[inline(always)]
    pub fn to_rgba(self) -> Rgba<u8> {
        match self {
            Color::Rgba(r, g, b, a) => Rgba([r, g, b, a]),
            Color::White => Rgba([255, 255, 255, 255]),
            Color::Black => Rgba([0, 0, 0, 255]),
            Color::Yellow => Rgba([255, 255, 0, 255]),
            Color::Green => Rgba([0, 255, 0, 255]),
            Color::Red => Rgba([255, 0, 0, 255]),
        }
    }

    pub fn from_hex(hex: &str) -> Self {
        let hex = hex.trim_start_matches('#');
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16).unwrap_or(255);
            let g = u8::from_str_radix(&hex[2..4], 16).unwrap_or(255);
            let b = u8::from_str_radix(&hex[4..6], 16).unwrap_or(255);
            Color::Rgba(r, g, b, 255)
        } else {
            Color::White
        }
    }
}
