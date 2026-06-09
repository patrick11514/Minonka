use crate::{
    draw::master_canvas::MasterCanvas,
    tasks::{error::TaskResult, types::FileResult},
    utils::{
        ensure_dir, get_cache_folder, get_current_dir, get_persistent_cache_folder, unique_id,
    },
};

pub async fn save_temp_canvas(mut canvas: MasterCanvas) -> TaskResult<FileResult> {
    canvas.render();

    let cache_path = get_cache_folder();
    let cache_dir = get_current_dir().join(cache_path);
    ensure_dir(&cache_dir).await?;

    let file_path = cache_dir.join(format!("{}.png", unique_id()));
    canvas.save_checked(file_path.to_string_lossy().as_ref())?;

    Ok(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    })
}

pub async fn save_persistent_canvas(
    mut canvas: MasterCanvas,
    image_name: &str,
) -> TaskResult<FileResult> {
    canvas.render();

    let persistent_path = get_persistent_cache_folder();
    let persistent_dir = get_current_dir().join(persistent_path);
    ensure_dir(&persistent_dir).await?;

    let file_path = persistent_dir.join(image_name);
    canvas.save_checked(file_path.to_string_lossy().as_ref())?;

    Ok(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    })
}

pub fn get_persistent_result(image_name: &str) -> TaskResult<Option<FileResult>> {
    let persistent_path = get_persistent_cache_folder();
    let file_path = get_current_dir().join(persistent_path).join(image_name);

    if !file_path.exists() {
        return Ok(None);
    }

    Ok(Some(FileResult::Local {
        path: file_path.to_string_lossy().to_string(),
    }))
}
