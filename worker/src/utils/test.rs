use image::{Rgba, RgbaImage};

/// Helper to evaluate if two discrete pixels match within color tolerances.
#[inline(always)]
fn is_pixel_equivalent(
    p1: Rgba<u8>,
    p2: Rgba<u8>,
    rgb_sq_threshold: i32,
    a_threshold: i32,
) -> bool {
    let a_diff = (p1[3] as i32 - p2[3] as i32).abs();
    if a_diff > a_threshold {
        return false;
    }

    // If both are completely or nearly transparent, ignore RGB noise
    if p1[3] < 5 && p2[3] < 5 {
        return true;
    }

    let r_diff = p1[0] as i32 - p2[0] as i32;
    let g_diff = p1[1] as i32 - p2[1] as i32;
    let b_diff = p1[2] as i32 - p2[2] as i32;

    (r_diff * r_diff + g_diff * g_diff + b_diff * b_diff) <= rgb_sq_threshold
}

/// Compares two layout frames pixel by pixel with color, spatial, and numerical error budgets.
pub fn generate_diff_mask(expected: &RgbaImage, actual: &RgbaImage) -> Option<RgbaImage> {
    let (w1, h1) = expected.dimensions();
    let (w2, h2) = actual.dimensions();

    if w1 != w2 || h1 != h2 {
        return None;
    }

    let mut diff_canvas = RgbaImage::new(w1, h1);
    let mut mismatch_count = 0;

    let rgb_sq_threshold = 384;
    let a_threshold = 15;

    for x in 0..w1 {
        for y in 0..h1 {
            let p1 = *expected.get_pixel(x, y);
            let p2 = *actual.get_pixel(x, y);

            // 1. Direct pixel match check
            let mut is_match = is_pixel_equivalent(p1, p2, rgb_sq_threshold, a_threshold);

            // 2. Spatial Neighbor Check (2-pixel radius)
            if !is_match {
                'spatial_search: for dx in -2..=2 {
                    for dy in -2..=2 {
                        if dx == 0 && dy == 0 {
                            continue;
                        }

                        let nx = x as i32 + dx;
                        let ny = y as i32 + dy;

                        if nx >= 0 && nx < w1 as i32 && ny >= 0 && ny < h1 as i32 {
                            let p2_neighbor = *actual.get_pixel(nx as u32, ny as u32);

                            if is_pixel_equivalent(p1, p2_neighbor, rgb_sq_threshold, a_threshold) {
                                is_match = true;
                                break 'spatial_search;
                            }
                        }
                    }
                }
            }

            // 3. Render Diff Canvas Output & Track Failures
            if is_match {
                let gray = ((p1[0] as u32 + p1[1] as u32 + p1[2] as u32) / 3) as u8;
                diff_canvas.put_pixel(x, y, Rgba([gray / 5, gray / 5, gray / 5, 255]));
            } else {
                diff_canvas.put_pixel(x, y, Rgba([255, 0, 127, 255]));
                mismatch_count += 1;
            }
        }
    }

    // 4. Evaluate Error Budget
    let max_allowed_mismatches = 200;

    if mismatch_count > max_allowed_mismatches {
        Some(diff_canvas)
    } else {
        None
    }
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
            let snapshots_dir = ::std::fs::canonicalize(snapshots_dir).expect("Failed to canonicalize snapshots directory");

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
