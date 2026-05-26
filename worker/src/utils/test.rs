#[cfg(test)]
#[macro_export]
macro_rules! assert_task_save {
    ($task_type:ty, $json_path:expr) => {{
        let payload = ::std::fs::read_to_string($json_path)
            .unwrap_or_else(|_| panic!("Failed to read test JSON file at: {}", $json_path));

        let input = (<$task_type as $crate::tasks::task::Task>::parse_input)(&payload)
            .expect("Failed to parse task input JSON");

        let context = $crate::context::AppContext::new().await;

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

        let context = $crate::context::AppContext::new().await;

        let outcome = (<$task_type as $crate::tasks::task::Task>::run)(input, context)
            .await
            .expect("Task run failed during test execution");

        if let $crate::tasks::task::TaskOutcome::Render(mut canvas, _) = outcome {
            canvas.render();

            let mut png_bytes = Vec::new();
            let actual_image = ::image::DynamicImage::ImageRgba8(canvas.background);

            actual_image
                .write_to(
                    &mut ::std::io::Cursor::new(&mut png_bytes),
                    ::image::ImageFormat::Png,
                )
                .expect("Failed to encode canvas to PNG bytes");

            // insta automatically hooks onto the containing #[test] function name!
            ::insta_image::assert_png_snapshot!(png_bytes);
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
            $crate::assert_task_save!($task_type, $json_path);
        } else {
            $crate::assert_task_visual!($task_type, $json_path);
        }
    }};
}
