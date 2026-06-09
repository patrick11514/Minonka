use image::Rgba;

#[derive(Debug, Clone, Copy)]
pub enum Color {
    Rgba(u8, u8, u8, u8),

    //Other
    White,
    Black,
    Yellow,
    Green,
    Red,
    Gray,

    //RANK
    Iron,        //'#99978b',
    Bronze,      // '#966502',
    Silver,      // '#99978b',
    Gold,        //: '#e6c41c',
    Platinum,    //: '#49ebaa',
    Emerald,     //: '#1b9627',
    Diamond,     //: '#5149eb',
    Master,      //: '#8117b3',
    Grandmaster, //: '#9e0606',
    Challenger,  // '#e5f051',
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
            Color::Gray => Rgba([138, 133, 120, 255]),
            Color::Iron => Rgba([153, 151, 139, 255]),
            Color::Bronze => Rgba([150, 101, 2, 255]),
            Color::Silver => Rgba([153, 151, 139, 255]),
            Color::Gold => Rgba([230, 196, 28, 255]),
            Color::Platinum => Rgba([73, 235, 170, 255]),
            Color::Emerald => Rgba([27, 150, 39, 255]),
            Color::Diamond => Rgba([81, 73, 235, 255]),
            Color::Master => Rgba([129, 23, 179, 255]),
            Color::Grandmaster => Rgba([158, 6, 6, 255]),
            Color::Challenger => Rgba([229, 240, 81, 255]),
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
