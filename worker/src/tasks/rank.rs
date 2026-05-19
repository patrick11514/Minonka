use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::draw::color::Color;
use crate::draw::container::Container;
use crate::draw::label::{Alignment, Label};
use crate::draw::sprite::Sprite;
use crate::tasks::{
    error::TaskResult,
    runtime,
    task::Task,
    types::{DefaultParametersInput, FileResult, WorkerJob},
};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RankQueueEntryInput {
    pub queue_type: String,
    pub wins: u32,
    pub losses: u32,
    pub tier: String,
    pub rank: String,
    pub league_points: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RankTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    pub ranks: Vec<RankQueueEntryInput>,
}

pub struct RankTask;

fn title_case(value: &str) -> String {
    if value.is_empty() {
        return String::new();
    }

    let lower = value.to_ascii_lowercase();
    let mut chars = lower.chars();
    let first = chars.next().unwrap_or_default().to_ascii_uppercase();
    format!("{first}{}", chars.collect::<String>())
}

fn queue_label(queue_type: &str) -> &'static str {
    match queue_type {
        "RANKED_SOLO_5x5" => "Ranked Solo/Duo",
        "RANKED_FLEX_SR" => "Ranked Flex",
        _ => "Ranked Queue",
    }
}

fn rank_color(tier: &str) -> Color {
    match tier {
        "CHALLENGER" => Color::from_hex("#E8CD7F"),
        "GRANDMASTER" => Color::from_hex("#D34C5C"),
        "MASTER" => Color::from_hex("#9F5FE0"),
        "DIAMOND" => Color::from_hex("#58B9E8"),
        "EMERALD" => Color::from_hex("#4CCF9A"),
        "PLATINUM" => Color::from_hex("#42B7AA"),
        "GOLD" => Color::from_hex("#D9B14A"),
        "SILVER" => Color::from_hex("#BDC3C7"),
        "BRONZE" => Color::from_hex("#B27A50"),
        "IRON" => Color::from_hex("#9A8F8F"),
        _ => Color::White,
    }
}

impl Task for RankTask {
    type Input = RankTaskInput;

    const NAME: &'static str = "rank";
    const JOB: WorkerJob = WorkerJob::Rank;

    fn run(input: Self::Input) -> TaskResult<FileResult> {
        let font = runtime::load_font_data()?;

        let background_path = runtime::resolve_existing(&[
            "assets/other/background.png",
            "../assets/other/background.png",
        ])
        .ok_or_else(|| {
            crate::tasks::error::TaskError::Runtime(
                "Missing assets/other/background.png".to_string(),
            )
        })?;
        let mut canvas = crate::draw::master_canvas::MasterCanvas::from_path(
            background_path.to_string_lossy().as_ref(),
            &font,
        );

        let (canvas_width, canvas_height) = canvas.dimensions();
        let profile_width = 800u32.min(canvas_width);

        let mut profile = Container::new(0, 0);

        profile.add_child(Box::new(Label::new(
            input.default.region.clone(),
            40,
            Color::White,
            Alignment::Middle,
            profile_width / 2,
            35,
        )));

        let level_path =
            runtime::resolve_existing(&["assets/other/level.png", "../assets/other/level.png"]);
        if let Some(level_path) = level_path {
            let mut level_bg =
                Sprite::from_path_checked(level_path.to_string_lossy().as_ref(), 0, 100)?;
            level_bg.resize_to_width(180);
            let (level_w, level_h) = level_bg.dimensions();
            let level_x = profile_width.saturating_sub(level_w) / 2;
            let level_y = 100;
            let level_center_x = level_x + level_w / 2;
            let level_center_y = level_y + level_h / 2;
            profile.add_child(Box::new(Sprite::new(
                level_bg.into_image(),
                level_x,
                level_y,
            )));

            profile.add_child(Box::new(Label::new(
                input.default.level.to_string(),
                36,
                Color::White,
                Alignment::Middle,
                level_center_x,
                level_center_y.saturating_sub(16),
            )));
        }

        let profile_icon_path = runtime::resolve_existing(&[
            &format!(
                "assets/ddragon/_ROOT_/img/profileicon/{}.png",
                input.default.profile_icon_id
            ),
            &format!(
                "../assets/ddragon/_ROOT_/img/profileicon/{}.png",
                input.default.profile_icon_id
            ),
        ]);
        if let Some(profile_icon_path) = profile_icon_path {
            let mut profile_icon =
                Sprite::from_path_checked(profile_icon_path.to_string_lossy().as_ref(), 0, 0)?;
            profile_icon.resize_to_width(360);
            let (icon_w, icon_h) = profile_icon.dimensions();
            let icon_x = profile_width.saturating_sub(icon_w) / 2;
            let icon_y = canvas_height.saturating_sub(icon_h) / 2;
            profile.add_child(Box::new(Sprite::new(
                profile_icon.into_image(),
                icon_x,
                icon_y,
            )));
        }

        profile.add_child(Box::new(Label::new(
            format!("{}#{}", input.default.game_name, input.default.tag_line),
            50,
            Color::White,
            Alignment::Middle,
            profile_width / 2,
            canvas_height.saturating_sub(200),
        )));

        canvas.container.add_child(Box::new(profile));

        let mut ranks = input.ranks;
        ranks.sort_by_key(|entry| match entry.queue_type.as_str() {
            "RANKED_SOLO_5x5" => 0,
            "RANKED_FLEX_SR" => 1,
            _ => 2,
        });

        if ranks.is_empty() {
            canvas.container.add_child(Box::new(Label::new(
                "No ranked queues".to_string(),
                60,
                Color::White,
                Alignment::Middle,
                profile_width + (canvas_width.saturating_sub(profile_width) / 2),
                canvas_height / 2,
            )));
            return runtime::save_temp_canvas(canvas);
        }

        let columns_width = canvas_width.saturating_sub(profile_width);
        let column_width = if ranks.is_empty() {
            columns_width
        } else {
            (columns_width / ranks.len() as u32).max(1)
        };

        for (index, rank) in ranks.iter().enumerate() {
            let offset_x = profile_width + column_width * index as u32;

            let mut column = Container::new(offset_x, 0);

            column.add_child(Box::new(Label::new(
                queue_label(&rank.queue_type).to_string(),
                44,
                Color::White,
                Alignment::Middle,
                column_width / 2,
                40,
            )));

            column.add_child(Box::new(Label::new(
                format!("{} {}", title_case(&rank.tier), rank.rank),
                46,
                rank_color(&rank.tier),
                Alignment::Middle,
                column_width / 2,
                140,
            )));

            let tier_name = title_case(&rank.tier);
            let rank_icon_path = runtime::resolve_existing(&[
                &format!("assets/ranks/Ranked Emblems Latest/Rank={tier_name}.png"),
                &format!("../assets/ranks/Ranked Emblems Latest/Rank={tier_name}.png"),
            ]);
            let mut icon_bottom = 360;
            if let Some(rank_icon_path) = rank_icon_path {
                let mut rank_icon =
                    Sprite::from_path_checked(rank_icon_path.to_string_lossy().as_ref(), 0, 180)?;
                rank_icon.resize_to_width((column_width as f32 * 0.75) as u32);
                let (icon_w, icon_h) = rank_icon.dimensions();
                let icon_x = (column_width.saturating_sub(icon_w)) / 2;
                let icon_y = 180;
                icon_bottom = icon_y + icon_h;
                column.add_child(Box::new(Sprite::new(
                    rank_icon.into_image(),
                    icon_x,
                    icon_y,
                )));
            }

            column.add_child(Box::new(Label::new(
                format!("{} LP", rank.league_points),
                42,
                Color::White,
                Alignment::Middle,
                column_width / 2,
                icon_bottom + 16,
            )));

            let games = rank.wins + rank.losses;
            let wr = if games > 0 {
                (rank.wins as f32 / games as f32) * 100.0
            } else {
                0.0
            };

            column.add_child(Box::new(Label::new(
                format!("WR: {:.2}%", wr),
                40,
                if wr >= 50.0 { Color::Green } else { Color::Red },
                Alignment::Middle,
                column_width / 2,
                icon_bottom + 80,
            )));

            column.add_child(Box::new(Label::new(
                format!("Wins - {}", rank.wins),
                38,
                Color::Green,
                Alignment::Middle,
                column_width / 2,
                icon_bottom + 136,
            )));

            column.add_child(Box::new(Label::new(
                format!("Losses - {}", rank.losses),
                38,
                Color::Red,
                Alignment::Middle,
                column_width / 2,
                icon_bottom + 188,
            )));

            canvas.container.add_child(Box::new(column));
        }

        runtime::save_temp_canvas(canvas)
    }
}
