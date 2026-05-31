use serde::{Deserialize, Deserializer};

pub fn deserialize_ban_id<'de, D>(deserializer: D) -> Result<Option<u32>, D::Error>
where
    D: Deserializer<'de>,
{
    let id = i32::deserialize(deserializer)?;
    if id == -1 {
        Ok(None)
    } else {
        Ok(Some(id as u32))
    }
}
