use image::Rgba;
use imageproc::drawing::{draw_filled_circle_mut, draw_filled_rect_mut, draw_line_segment_mut};
use imageproc::rect::Rect;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::label::{Alignment, Label};
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::renderable::Renderable;
use crate::tasks::task::SaveStrategy;
use crate::tasks::{
    error::TaskResult,
    task::{Task, TaskOutcome},
    types::{DefaultParametersInput, ProfileParametersInput, WorkerJob},
};
use crate::utils::assets::get_background_asset;
use crate::utils::locale::AppLocale;
use crate::utils::rank::Tier;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct GraphLpEntryInput {
    pub lp: i32,
    pub rank: String,
    pub tier: String,
    pub time: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct GraphTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    #[serde(flatten)]
    pub profile: ProfileParametersInput,
    pub queue: String,
    pub history: Vec<GraphLpEntryInput>,
}

pub struct GraphTask;

fn get_total_lp(tier: &str, rank: &str, lp: i32) -> i32 {
    let tier_idx = match tier.to_ascii_uppercase().as_str() {
        "IRON" => 0,
        "BRONZE" => 1,
        "SILVER" => 2,
        "GOLD" => 3,
        "PLATINUM" => 4,
        "EMERALD" => 5,
        "DIAMOND" => 6,
        "MASTER" => 7,
        "GRANDMASTER" => 8,
        "CHALLENGER" => 9,
        _ => 0,
    };
    let rank_idx = match rank.to_ascii_uppercase().as_str() {
        "IV" => 0,
        "III" => 1,
        "II" => 2,
        "I" => 3,
        _ => 0,
    };
    tier_idx * 400 + rank_idx * 100 + lp
}

fn get_tier_rank_from_total_lp(total_lp: i32) -> (Tier, String) {
    let tier_val = total_lp / 400;
    let tier_index = tier_val.clamp(0, 9);
    let rank_val = (total_lp % 400) / 100;
    let rank_index = rank_val.clamp(0, 3);

    let tier = match tier_index {
        0 => Tier::Iron,
        1 => Tier::Bronze,
        2 => Tier::Silver,
        3 => Tier::Gold,
        4 => Tier::Platinum,
        5 => Tier::Emerald,
        6 => Tier::Diamond,
        7 => Tier::Master,
        8 => Tier::Grandmaster,
        _ => Tier::Challenger,
    };

    let rank_str = match rank_index {
        0 => "IV".to_string(),
        1 => "III".to_string(),
        2 => "II".to_string(),
        _ => "I".to_string(),
    };

    (tier, rank_str)
}

impl Task for GraphTask {
    type Input = GraphTaskInput;

    const NAME: &'static str = "graph";
    const JOB: WorkerJob = WorkerJob::Graph;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let mut canvas = MasterCanvas::from_asset(get_background_asset(), context.into()).await?;

        let pts: Vec<i32> = input
            .history
            .iter()
            .map(|h| get_total_lp(&h.tier, &h.rank, h.lp))
            .collect();
        if pts.is_empty() {
            return Ok(TaskOutcome::Render(canvas, SaveStrategy::Temporary));
        }

        let min_val = *pts.iter().min().unwrap_or(&0);
        let max_val = *pts.iter().max().unwrap_or(&100);

        let mut y_min = (min_val as f32 / 100.0).floor() as i32 * 100;
        let mut y_max = (max_val as f32 / 100.0).ceil() as i32 * 100;
        if y_max <= y_min {
            y_max = y_min + 100;
        }
        if y_max - y_min < 200 {
            y_min -= 100;
            y_max += 100;
        }

        let (w, h) = canvas.dimensions();
        let padding_left = 220;
        let padding_right = 80;
        let padding_top = 180;
        let padding_bottom = 120;

        let plot_w = w - padding_left - padding_right;
        let plot_h = h - padding_top - padding_bottom;

        let x_start = padding_left as i32;
        let x_end = (w - padding_right) as i32;
        let y_start = (h - padding_bottom) as i32;
        let y_end = padding_top as i32;

        let locale = AppLocale::from_str(&input.default.locale);

        // Draw division bands
        let mut current_div = y_min;
        while current_div < y_max {
            let div_start = current_div;
            let div_end = current_div + 100;

            let y_canvas_start = y_start
                - (((div_start - y_min) as f32 / (y_max - y_min) as f32) * plot_h as f32) as i32;
            let y_canvas_end = y_start
                - (((div_end - y_min) as f32 / (y_max - y_min) as f32) * plot_h as f32) as i32;

            let band_h = (y_canvas_start - y_canvas_end) as u32;

            let (tier, rank_str) = get_tier_rank_from_total_lp(div_start);
            let base_color = tier.color().to_rgba();
            let band_color = Rgba([base_color[0], base_color[1], base_color[2], 20]);

            draw_filled_rect_mut(
                &mut canvas.background,
                Rect::at(x_start, y_canvas_end).of_size(plot_w, band_h),
                band_color,
            );

            if div_start > y_min {
                let boundary_line_color = Rgba([base_color[0], base_color[1], base_color[2], 50]);
                draw_line_segment_mut(
                    &mut canvas.background,
                    (x_start as f32, y_canvas_start as f32),
                    (x_end as f32, y_canvas_start as f32),
                    boundary_line_color,
                );
            }

            let y_label = y_canvas_end + (band_h as i32) / 2 - 12;
            let label_text = if tier >= Tier::Master {
                locale.tier_label(&tier.as_str())
            } else {
                format!("{} {}", locale.tier_label(&tier.as_str()), rank_str)
            };

            Label::new(label_text)
                .size(24)
                .color(tier.color())
                .align(Alignment::End)
                .x(x_start - 20)
                .y(y_label)
                .render(&mut canvas.background, &canvas.fonts, 0, 0);

            current_div += 100;
        }

        // Draw borders
        let border_color = Rgba([255, 255, 255, 40]);
        draw_line_segment_mut(
            &mut canvas.background,
            (x_start as f32, y_end as f32),
            (x_start as f32, y_start as f32),
            border_color,
        );
        draw_line_segment_mut(
            &mut canvas.background,
            (x_start as f32, y_start as f32),
            (x_end as f32, y_start as f32),
            border_color,
        );
        draw_line_segment_mut(
            &mut canvas.background,
            (x_end as f32, y_end as f32),
            (x_end as f32, y_start as f32),
            border_color,
        );
        draw_line_segment_mut(
            &mut canvas.background,
            (x_start as f32, y_end as f32),
            (x_end as f32, y_end as f32),
            border_color,
        );

        // Draw grid lines and X-axis timestamps
        let n_points = pts.len();
        let step = if n_points > 10 { n_points / 5 } else { 1 };

        for i in 0..n_points {
            let x_i = if n_points > 1 {
                x_start + (i as f32 / (n_points - 1) as f32 * plot_w as f32) as i32
            } else {
                x_start + (plot_w as i32) / 2
            };

            if i % step == 0 || i == n_points - 1 {
                let grid_color = Rgba([255, 255, 255, 15]);
                draw_line_segment_mut(
                    &mut canvas.background,
                    (x_i as f32, y_end as f32),
                    (x_i as f32, y_start as f32),
                    grid_color,
                );

                if let Some(ref time_str) = input.history[i].time {
                    let label_text = format!("{} ({} LP)", time_str, input.history[i].lp);
                    Label::new(label_text)
                        .size(20)
                        .color(Color::Rgba(180, 180, 180, 255))
                        .align(Alignment::Middle)
                        .x(x_i)
                        .y(y_start + 20)
                        .render(&mut canvas.background, &canvas.fonts, 0, 0);
                }
            }
        }

        // Draw graph lines
        let line_color = Rgba([0, 240, 255, 255]);
        for i in 0..(n_points - 1) {
            let x_i = x_start + (i as f32 / (n_points - 1) as f32 * plot_w as f32) as i32;
            let y_i = y_start
                - (((pts[i] - y_min) as f32 / (y_max - y_min) as f32) * plot_h as f32) as i32;

            let x_next = x_start + ((i + 1) as f32 / (n_points - 1) as f32 * plot_w as f32) as i32;
            let y_next = y_start
                - (((pts[i + 1] - y_min) as f32 / (y_max - y_min) as f32) * plot_h as f32) as i32;

            for dx in -1..=1 {
                for dy in -1..=1 {
                    draw_line_segment_mut(
                        &mut canvas.background,
                        ((x_i + dx) as f32, (y_i + dy) as f32),
                        ((x_next + dx) as f32, (y_next + dy) as f32),
                        line_color,
                    );
                }
            }
        }

        // Draw circles at data points
        for i in 0..n_points {
            let x_i = if n_points > 1 {
                x_start + (i as f32 / (n_points - 1) as f32 * plot_w as f32) as i32
            } else {
                x_start + (plot_w as i32) / 2
            };
            let y_i = y_start
                - (((pts[i] - y_min) as f32 / (y_max - y_min) as f32) * plot_h as f32) as i32;

            draw_filled_circle_mut(&mut canvas.background, (x_i, y_i), 6, line_color);
            draw_filled_circle_mut(
                &mut canvas.background,
                (x_i, y_i),
                3,
                Rgba([255, 255, 255, 255]),
            );
        }

        // Header info
        let title_text = format!(
            "{} - {}#{}",
            locale.queue_label(&input.queue),
            input.profile.game_name,
            input.profile.tag_line
        );
        Label::new(title_text)
            .size(44)
            .bold()
            .color(Color::White)
            .x(80)
            .y(45)
            .render(&mut canvas.background, &canvas.fonts, 0, 0);

        let subtitle_text = format!(
            "Level {} | {}",
            input.profile.level,
            locale.region(&input.default.region)
        );
        Label::new(subtitle_text)
            .size(24)
            .color(Color::Gray)
            .x(80)
            .y(100)
            .render(&mut canvas.background, &canvas.fonts, 0, 0);

        Ok(TaskOutcome::Render(canvas, SaveStrategy::Temporary))
    }
}

#[cfg(test)]
mod test {
    #[tokio::test]
    async fn test_graph() {
        crate::assert_task!(super::GraphTask, "test_files/graph.json");
    }

    #[tokio::test]
    async fn test_graph_short() {
        crate::assert_task!(super::GraphTask, "test_files/graph_short.json");
    }

    #[tokio::test]
    async fn test_graph_stuck() {
        crate::assert_task!(super::GraphTask, "test_files/graph_stuck.json");
    }

    #[tokio::test]
    async fn test_graph_climb() {
        crate::assert_task!(super::GraphTask, "test_files/graph_climb.json");
    }
}
