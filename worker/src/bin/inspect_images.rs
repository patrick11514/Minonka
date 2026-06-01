use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

struct ReviewItem {
    base_name: String,
    ref_path: PathBuf,
    actual_path: PathBuf,
    diff_path: PathBuf,
}

fn main() -> io::Result<()> {
    let mut pending_reviews = Vec::new();

    // Scan starting from the current directory—works from root or sub-folders perfectly
    scan_for_snapshots(Path::new("."), &mut pending_reviews)?;

    if pending_reviews.is_empty() {
        println!("✨ All snapshots match their targets perfectly. Nothing to review!");
        return Ok(());
    }

    println!(
        "Found {} layout mutations requiring validation:\n",
        pending_reviews.len()
    );
    let mut stdin = io::stdin();

    for (idx, item) in pending_reviews.iter().enumerate() {
        println!("------------------------------------------------------------");
        println!(
            "Reviewing mutation [{}/{}] : {}",
            idx + 1,
            pending_reviews.len(),
            item.base_name
        );
        println!("  - Reference: {}", item.ref_path.display());
        println!("  + Actual:    {}", item.actual_path.display());
        println!("  Δ Difference:{}", item.diff_path.display());
        println!("------------------------------------------------------------");
        print!("👉 Choose Action: [a]ccept, [r]eject, [s]kip: ");
        io::stdout().flush()?;

        let mut input = String::new();
        stdin.read_line(&mut input)?;

        match input.trim().to_lowercase().as_str() {
            "a" | "accept" => {
                // Bless layout mutation: move actual output over the baseline image reference
                fs::rename(&item.actual_path, &item.ref_path)?;
                let _ = fs::remove_file(&item.diff_path);
                println!("✅ Blessed change! Snapshot baseline updated.");
            }
            "r" | "reject" => {
                // Trash layout mutation
                let _ = fs::remove_file(&item.actual_path);
                let _ = fs::remove_file(&item.diff_path);
                println!("🗑️  Rejected changes. Visual mutations wiped from disk.");
            }
            _ => {
                println!("⏭️  Skipped review item for now.");
            }
        }
        println!();
    }

    Ok(())
}

/// Recursively scans directories to find any active layout regression artifacts
fn scan_for_snapshots(dir: &Path, acc: &mut Vec<ReviewItem>) -> io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    // Skip build outputs and git metadata folders to maintain high performance
    if let Some(dir_name) = dir.file_name().and_then(|n| n.to_str()) {
        if dir_name == "target" || dir_name == ".git" || dir_name == ".cargo" {
            return Ok(());
        }
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Keep walking down the directory tree
            scan_for_snapshots(&path, acc)?;
        } else if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // Match any regression file directly by its suffix signature
                if file_name.ends_with(".actual.png") {
                    if let Some(stem) = file_name.strip_suffix(".actual.png") {
                        let parent = path.parent().unwrap_or_else(|| Path::new("."));

                        acc.push(ReviewItem {
                            base_name: stem.to_string(),
                            ref_path: parent.join(format!("{}.png", stem)),
                            actual_path: path.clone(),
                            diff_path: parent.join(format!("{}.diff.png", stem)),
                        });
                    }
                }
            }
        }
    }
    Ok(())
}
