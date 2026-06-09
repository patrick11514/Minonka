use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Augment {
    pub id: u32,
    pub name: String,
    pub icon_large: String,
    pub icon_small: String,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Augments {
    pub augments: Vec<Augment>,
}
