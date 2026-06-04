use image::{Rgba, RgbaImage};

/// Compares two layout frames pixel by pixel.
/// Returns a dimmed context canvas highlighted with neon magenta marks where layout bugs exist.
pub fn generate_diff_mask(expected: &RgbaImage, actual: &RgbaImage) -> Option<RgbaImage> {
    let (w1, h1) = expected.dimensions();
    let (w2, h2) = actual.dimensions();

    if w1 != w2 || h1 != h2 {
        return None;
    }

    let mut diff_canvas = RgbaImage::new(w1, h1);
    let mut has_changes = false;

    for x in 0..w1 {
        for y in 0..h1 {
            let p1 = expected.get_pixel(x, y);
            let p2 = actual.get_pixel(x, y);

            let is_match = if p1[3] == 0 && p2[3] == 0 {
                true
            } else {
                (p1[0] as i32 - p2[0] as i32).abs() <= 2
                    && (p1[1] as i32 - p2[1] as i32).abs() <= 2
                    && (p1[2] as i32 - p2[2] as i32).abs() <= 2
                    && (p1[3] as i32 - p2[3] as i32).abs() <= 2
            };

            if is_match {
                // Dim down matching elements to provide structural composition context
                let gray = ((p1[0] as u32 + p1[1] as u32 + p1[2] as u32) / 3) as u8;
                diff_canvas.put_pixel(x, y, Rgba([gray / 5, gray / 5, gray / 5, 255]));
            } else {
                // Glaring neon magenta highlight pinpointing text/item offsets
                diff_canvas.put_pixel(x, y, Rgba([255, 0, 127, 255]));
                has_changes = true;
            }
        }
    }

    if has_changes { Some(diff_canvas) } else { None }
}

#[cfg(test)]
#[macro_export]
macro_rules! assert_task_save {
    ($task_type:ty, $json_path:expr) => {{
        let payload = ::std::fs::read_to_string($json_path)
            .unwrap_or_else(|_| panic!("Failed to read test JSON file at: {}", $json_path));

        let input = (<$task_type as $crate::tasks::task::Task>::parse_input)(&payload)
            .expect("Failed to parse task input JSON");

        let context = $crate::context::AppContext::new()
            .await
            .expect("Failed to initialize worker context");

        let outcome = (<$task_type as $crate::tasks::task::Task>::run)(input, context)
            .await
            .expect("Task run failed during test execution");

        if let $crate::tasks::task::TaskOutcome::Render(mut canvas, _) = outcome {
            canvas.render();

            let png_path = $json_path.replace(".json", ".png");
            canvas
                .save_checked(&png_path)
                .unwrap_or_else(|_| panic!("Failed to save canvas PNG to path: {}", png_path));
        } else {
            panic!("Expected task to return a Render outcome, but it skipped execution.");
        }
    }};
}

#[cfg(test)]
#[macro_export]
macro_rules! assert_task_visual {
    ($task_type:ty, $json_path:expr) => {{
        let payload = ::std::fs::read_to_string($json_path)
            .unwrap_or_else(|_| panic!("Failed to read test JSON file at: {}", $json_path));

        let input = (<$task_type as $crate::tasks::task::Task>::parse_input)(&payload)
            .expect("Failed to parse task input JSON");

        let context = $crate::context::AppContext::new()
            .await
            .expect("Failed to initialize worker context");

        let outcome = (<$task_type as $crate::tasks::task::Task>::run)(input, context)
            .await
            .expect("Task run failed during test execution");

        if let $crate::tasks::task::TaskOutcome::Render(mut canvas, _) = outcome {
            canvas.render();

            // 1. Resolve the localized target snapshots directory relative to the .rs code file
            let rs_source_file = ::std::path::Path::new(file!());
            let rs_dir = rs_source_file.parent().expect("Failed to get test source directory");
            let snapshots_dir = rs_dir.join("snapshots");

            if !snapshots_dir.exists() {
                ::std::fs::create_dir_all(&snapshots_dir).unwrap();
            }

            // 2. Extract the canonical test name from the current cargo worker thread
            let snap_slug = ::std::thread::current().name().unwrap_or("unknown_test").replace("::", "__");

            let expected_path = snapshots_dir.join(format!("{}.png", snap_slug));
            let actual_path = snapshots_dir.join(format!("{}.actual.png", snap_slug));
            let diff_path = snapshots_dir.join(format!("{}.diff.png", snap_slug));

            let actual_image = canvas.background;
            let update_snapshots = ::std::env::var("UPDATE_SNAPSHOTS").is_ok();

            // 3. Initialize or overwrite reference baseline snapshots
            if !expected_path.exists() || update_snapshots {
                actual_image.save(&expected_path)
                    .unwrap_or_else(|_| panic!("Failed to save master snapshot reference at: {:?}", expected_path));

                let _ = ::std::fs::remove_file(&actual_path);
                let _ = ::std::fs::remove_file(&diff_path);
            } else {
                // 4. Load baseline image
                let expected_image = ::image::open(&expected_path)
                    .unwrap_or_else(|_| panic!("Failed to open master snapshot reference at: {:?}", expected_path))
                    .to_rgba8();

                if expected_image.dimensions() != actual_image.dimensions() {
                    actual_image.save(&actual_path).unwrap();
                    panic!(
                        "\n❌ Size Regression Caught!\n  Expected Reference: {:?}\n  Actual Output: {:?}\n",
                        expected_image.dimensions(), actual_image.dimensions()
                    );
                }

                // 5. Evaluate layout deviations
                if let Some(diff_canvas) = $crate::utils::test::generate_diff_mask(&expected_image, &actual_image) {
                    actual_image.save(&actual_path).unwrap();
                    diff_canvas.save(&diff_path).unwrap();

                    panic!(
                        "\n❌ Visual layout regression detected!\n  Master Reference: {}\n  Your Current Output: {}\n  Highlighted Deviations: {}\nRun 'cargo run --bin inspect_images' to review and bless changes.\n",
                        expected_path.display(), actual_path.display(), diff_path.display()
                    );
                } else {
                    // Clean layout pass! Clear old regression artifacts if they exist
                    let _ = ::std::fs::remove_file(&actual_path);
                    let _ = ::std::fs::remove_file(&diff_path);
                }
            }
        } else {
            panic!("Expected task to return a Render outcome, but it skipped execution.");
        }
    }};
}

#[cfg(test)]
#[macro_export]
macro_rules! assert_task {
    ($task_type:ty, $json_path:expr) => {{
        if cfg!(feature = "save") {
            $crate::utils::init_tracing();
            $crate::assert_task_save!($task_type, $json_path);
        } else {
            $crate::assert_task_visual!($task_type, $json_path);
        }
    }};
}
