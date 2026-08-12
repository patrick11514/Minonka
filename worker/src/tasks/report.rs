use crate::cache::json::JsonCache;
use crate::context::AppContext;
use crate::draw::color::Color;
use crate::draw::container::{AlignItems, Container, ContainerDirection, JustifyContent};
use crate::draw::label::Label;
use crate::draw::master_canvas::MasterCanvas;
use crate::draw::sprite::Sprite;
use crate::tasks::error::TaskResult;
use crate::tasks::match_task::MatchParticipantInput;
use crate::tasks::task::{SaveStrategy, Task, TaskOutcome};
use crate::tasks::types::{DefaultParametersInput, MatchMetadataInput, ProfileParametersInput, WorkerJob};
use crate::utils::assets::{
    Asset, AssetType, get_item_asset, get_perk_asset, get_profile_icon, get_rune_asset,
    get_summoner_asset,
};
use crate::utils::locale::AppLocale;
use crate::utils::storage::get_persistent_result;
use crate::utils::{fix_champion_name, format_date, format_duration, format_with_spaces};
use futures::future::try_join_all;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "export-ts", ts(export))]
pub struct ReportTaskInput {
    #[serde(flatten)]
    pub default: DefaultParametersInput,
    #[serde(flatten)]
    pub profile: ProfileParametersInput,
    pub metadata: MatchMetadataInput,
    pub queue_name: String,
    pub game_creation: i64,
    pub game_duration: u32,
    pub participant: MatchParticipantInput,
    pub team_total_damage: u32,
    pub team_total_kills: u32,
}

pub struct ReportTask;

impl Task for ReportTask {
    type Input = ReportTaskInput;

    const NAME: &'static str = "report";
    const JOB: WorkerJob = WorkerJob::Report;

    async fn run(input: Self::Input, context: AppContext) -> TaskResult<TaskOutcome> {
        let match_key = format!(
            "report_{}_{}_{}.png",
            input.default.puuid, input.metadata.match_id, input.default.locale
        );

        if let Some(result) = get_persistent_result(&match_key)? {
            return Ok(TaskOutcome::Existing(result));
        }

        let locale = AppLocale::from_str(&input.default.locale);
        let json: JsonCache = context.clone().into();

        let player = &input.participant;

        // 1. Base Canvas - 900 x 1200 (3:4 ratio)
        // Solid black background as WIP, elements padded inside
        let mut base_bg = image::RgbaImage::new(900, 1200);
        for pixel in base_bg.pixels_mut() {
            *pixel = image::Rgba([12, 16, 22, 255]);
        }

        let canvas = MasterCanvas::new(base_bg, context.into())
            .with_layout(|root| {
                root.direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .gap(20)
                    .padding(30)
            });

        let outcome_str = if input.participant.win {
            "VICTORY"
        } else {
            "DEFEAT"
        };

        let outcome_color = if input.participant.win {
            Color::Rgba(0, 225, 120, 255)
        } else {
            Color::Rgba(255, 65, 65, 255)
        };

        // Champion Splash / Icon
        let champion = Asset::new(
            AssetType::DDragon,
            format!(
                "_ROOT_/img/champion/{}.png",
                fix_champion_name(&player.champion_name)
            ),
        );
        let mut champ_sprite = Sprite::from_asset(&champion, 0, 0)
            .await
            .expect("Failed to read champion asset");
        champ_sprite.resize_to_width(120);

        let profile_icon_asset = get_profile_icon(input.profile.profile_icon_id).await?;
        let mut profile_icon = Sprite::from_asset(&profile_icon_asset, 0, 0).await?;
        profile_icon.resize_to_width(90);

        // Runes: full tree (4 primary + 2 secondary + 3 stat shards)
        let primary_style_info = player.perks.styles.first();
        let secondary_style_info = player.perks.styles.iter().nth(1);

        let mut primary_rune_sprites = Vec::new();
        if let Some(primary_style) = primary_style_info {
            let primary_tree_asset = get_rune_asset(primary_style.style, None, &json, &locale).await?;
            if let Ok(mut sprite) = Sprite::from_asset(&primary_tree_asset, 0, 0).await {
                sprite.resize_to_width(32);
                primary_rune_sprites.push(sprite);
            }
            for (idx, sel) in primary_style.selections.iter().enumerate() {
                let asset = get_perk_asset(sel.perk, &json, &locale).await?;
                if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                    let width = if idx == 0 { 44 } else { 32 };
                    sprite.resize_to_width(width);
                    primary_rune_sprites.push(sprite);
                }
            }
        }

        let mut secondary_rune_sprites = Vec::new();
        if let Some(secondary_style) = secondary_style_info {
            let secondary_tree_asset = get_rune_asset(secondary_style.style, None, &json, &locale).await?;
            if let Ok(mut sprite) = Sprite::from_asset(&secondary_tree_asset, 0, 0).await {
                sprite.resize_to_width(32);
                secondary_rune_sprites.push(sprite);
            }
            for sel in &secondary_style.selections {
                let asset = get_perk_asset(sel.perk, &json, &locale).await?;
                if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                    sprite.resize_to_width(30);
                    secondary_rune_sprites.push(sprite);
                }
            }
        }

        let mut stat_shard_sprites = Vec::new();
        if let Some(stat_perks) = &player.perks.stat_perks {
            for perk_id in [stat_perks.offense, stat_perks.flex, stat_perks.defense] {
                if perk_id > 0 {
                    let asset = get_perk_asset(perk_id, &json, &locale).await?;
                    if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                        sprite.resize_to_width(26);
                        stat_shard_sprites.push(sprite);
                    }
                }
            }
        }

        // Summoner Spells
        let sum1_asset = get_summoner_asset(player.summoner1_id, &json, &locale).await?;
        let mut sum1 = Sprite::from_asset(&sum1_asset, 0, 0).await?;
        sum1.resize_to_width(44);

        let sum2_asset = get_summoner_asset(player.summoner2_id, &json, &locale).await?;
        let mut sum2 = Sprite::from_asset(&sum2_asset, 0, 0).await?;
        sum2.resize_to_width(44);

        // Items (0..6 + 6 for trinket)
        let item_sprites = try_join_all((0..7).map(|idx| {
            let item_id = match idx {
                0 => player.item0,
                1 => player.item1,
                2 => player.item2,
                3 => player.item3,
                4 => player.item4,
                5 => player.item5,
                _ => player.item6,
            };
            async move {
                let asset = get_item_asset(item_id);
                if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                    sprite.resize_to_width(56);
                    Ok::<Option<Sprite>, crate::tasks::error::TaskError>(Some(sprite))
                } else {
                    Ok::<Option<Sprite>, crate::tasks::error::TaskError>(None)
                }
            }
        }))
        .await?;

        // Calculate KDA ratio and KP
        let kda_ratio = if player.deaths == 0 {
            (player.kills + player.assists) as f32
        } else {
            (player.kills + player.assists) as f32 / player.deaths as f32
        };

        let kp_pct = if input.team_total_kills > 0 {
            ((player.kills + player.assists) as f32 / input.team_total_kills as f32) * 100.0
        } else {
            0.0
        };

        let dmg_pct = if input.team_total_damage > 0 {
            (player.total_damage_dealt_to_champions as f32 / input.team_total_damage as f32) * 100.0
        } else {
            0.0
        };

        let total_cs = player.total_minions_killed;
        let cs_per_min = if input.game_duration > 0 {
            (total_cs as f32) / (input.game_duration as f32 / 60.0)
        } else {
            0.0
        };

        // Localized Labels
        let is_cz = matches!(locale, AppLocale::Cz);
        let dmg_label = if is_cz {
            "Poškození:"
        } else {
            "Damage dealt:"
        };
        let vision_label = if is_cz {
            "Skóre vize:"
        } else {
            "Vision score:"
        };
        let gold_farm_label = if is_cz {
            "Zlato a farm:"
        } else {
            "Gold & Farm:"
        };
        let p_kill_label = if is_cz {
            "P/Zabití"
        } else {
            "P/Kill"
        };
        let team_share_label = if is_cz {
            "z týmu"
        } else {
            "of team"
        };

        // Render layout
        let canvas = canvas.with_layout(|root| {
            root
                // 1. Top Header Bar (Enlarged)
                .child(
                    Container::new()
                        .direction(ContainerDirection::Row)
                        .gap(20)
                        .align_items(AlignItems::Center)
                        .child(profile_icon)
                        .child(
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(4)
                                .child(
                                    Label::new(format!("{}#{}", input.profile.game_name, input.profile.tag_line))
                                        .bold()
                                        .size(40),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} • {} • {}",
                                        input.queue_name,
                                        format_date(input.game_creation, &locale),
                                        format_duration(input.game_duration)
                                    ))
                                    .size(24)
                                    .color(Color::Gray),
                                ),
                        ),
                )
                // 2. Outcome Banner
                .child(
                    Container::new()
                        .align_items(AlignItems::Center)
                        .justify(JustifyContent::Center)
                        .child(
                            Label::new(outcome_str)
                                .bold()
                                .size(48)
                                .color(outcome_color),
                        ),
                )
                // 3. Main Champion & KDA Spotlight Card
                .child(
                    Container::new()
                        .direction(ContainerDirection::Row)
                        .gap(24)
                        .align_items(AlignItems::Center)
                        .child(champ_sprite)
                        .child(
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(6)
                                .child(
                                    Label::new(format!("{}/{}/{}", player.kills, player.deaths, player.assists))
                                        .bold()
                                        .size(44),
                                )
                                .child(
                                    Label::new(format!("{:.2}:1 KDA  |  {}: {:.0}%", kda_ratio, p_kill_label, kp_pct))
                                        .bold()
                                        .size(24)
                                        .color(Color::Rgba(0, 225, 240, 255)),
                                )
                                .child(
                                    Label::new(format!("Lvl {} {}", player.champ_level, player.champion_name))
                                        .size(20)
                                        .color(Color::Gray),
                                ),
                        ),
                )
                // 4. Spells & Full Runes Breakdown Row
                .child(
                    Container::new()
                        .direction(ContainerDirection::Column)
                        .gap(10)
                        .align_items(AlignItems::Center)
                        .child(
                            Container::new()
                                .direction(ContainerDirection::Row)
                                .gap(16)
                                .align_items(AlignItems::Center)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(8)
                                        .child(sum1)
                                        .child(sum2),
                                )
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(6)
                                        .align_items(AlignItems::Center)
                                        .childs(primary_rune_sprites),
                                ),
                        )
                        .child(
                            Container::new()
                                .direction(ContainerDirection::Row)
                                .gap(12)
                                .align_items(AlignItems::Center)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(6)
                                        .align_items(AlignItems::Center)
                                        .childs(secondary_rune_sprites),
                                )
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(4)
                                        .align_items(AlignItems::Center)
                                        .childs(stat_shard_sprites),
                                ),
                        ),
                )
                // 5. Performance Stat Grid (Cards with Czech/English Translation)
                .child(
                    Container::new()
                        .direction(ContainerDirection::Column)
                        .gap(16)
                        .child(
                            // Damage Card
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(4)
                                .child(
                                    Label::new(format!(
                                        "{} {} ({:.1}% {})",
                                        dmg_label,
                                        format_with_spaces(player.total_damage_dealt_to_champions),
                                        dmg_pct,
                                        team_share_label
                                    ))
                                    .bold()
                                    .size(22)
                                    .color(Color::Rgba(255, 90, 90, 255)),
                                ),
                        )
                        .child(
                            // Vision & Economy Card
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(4)
                                .child(
                                    Label::new(format!(
                                        "{} {}",
                                        vision_label,
                                        player.vision_score
                                    ))
                                    .bold()
                                    .size(22)
                                    .color(Color::Rgba(240, 200, 80, 255)),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} {} Gold • {} CS ({:.1} CS/min)",
                                        gold_farm_label,
                                        format_with_spaces(player.gold_earned),
                                        total_cs,
                                        cs_per_min
                                    ))
                                    .bold()
                                    .size(22)
                                    .color(Color::Rgba(220, 220, 220, 255)),
                                ),
                        ),
                )
                // 6. Items Footer Row
                .child(
                    Container::new()
                        .direction(ContainerDirection::Row)
                        .gap(10)
                        .align_items(AlignItems::Center)
                        .childs(item_sprites.into_iter().flatten()),
                )
        });

        Ok(TaskOutcome::Render(
            canvas,
            SaveStrategy::Persistent {
                filename: match_key,
            },
        ))
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[tokio::test]
    async fn test_report_match() {
        crate::assert_task!(ReportTask, "test_files/report.json");
    }
}
