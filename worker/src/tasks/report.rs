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
    Asset, AssetType, Stat, get_background_asset, get_item_asset, get_perk_asset,
    get_profile_icon, get_stat_asset, get_summoner_asset,
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

        // 1. Base Canvas - 900 x 1200 (3:4 ratio) with 90-degree rotated match background
        let mut bg_asset = Sprite::from_asset(&get_background_asset(), 0, 0).await?;
        bg_asset.rotate90();
        bg_asset.resize_to_width(900);
        if bg_asset.dimensions().1 < 1200 {
            bg_asset.resize_to_height(1200);
        }
        let full_bg = bg_asset.into_image();
        let base_bg = image::imageops::crop_imm(&full_bg, 0, 0, 900, 1200).to_image();

        let canvas = MasterCanvas::new(base_bg, context.into())
            .with_layout(|root| {
                root.direction(ContainerDirection::Column)
                    .align_items(AlignItems::Center)
                    .gap(18)
                    .padding_xy(40, 30)
                    .width(900)
                    .height(1200)
            });

        let outcome_str = if input.participant.win {
            "VICTORY"
        } else {
            "DEFEAT"
        };

        let outcome_color = if input.participant.win {
            Color::Rgba(0, 230, 130, 255)
        } else {
            Color::Rgba(255, 60, 60, 255)
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
        champ_sprite.resize_to_width(130);

        let profile_icon_asset = get_profile_icon(input.profile.profile_icon_id).await?;
        let mut profile_icon = Sprite::from_asset(&profile_icon_asset, 0, 0).await?;
        profile_icon.resize_to_width(96);

        // Runes: 2 Vertical Columns (Column 1: 4 Primary Runes stacked vertically; Column 2: 2 Secondary + 3 Stat Shards stacked vertically)
        let primary_style_info = player.perks.styles.first();
        let secondary_style_info = player.perks.styles.iter().nth(1);

        let mut primary_rune_sprites = Vec::new();
        if let Some(primary_style) = primary_style_info {
            for (idx, sel) in primary_style.selections.iter().enumerate() {
                let asset = get_perk_asset(sel.perk, &json, &locale).await?;
                if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                    let width = if idx == 0 { 40 } else { 32 };
                    sprite.resize_to_width(width);
                    primary_rune_sprites.push(sprite);
                }
            }
        }

        let mut secondary_and_shards = Vec::new();
        if let Some(secondary_style) = secondary_style_info {
            for sel in &secondary_style.selections {
                let asset = get_perk_asset(sel.perk, &json, &locale).await?;
                if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                    sprite.resize_to_width(30);
                    secondary_and_shards.push(sprite);
                }
            }
        }

        if let Some(stat_perks) = &player.perks.stat_perks {
            for perk_id in [stat_perks.offense, stat_perks.flex, stat_perks.defense] {
                if perk_id > 0 {
                    let asset = get_perk_asset(perk_id, &json, &locale).await?;
                    if let Ok(mut sprite) = Sprite::from_asset(&asset, 0, 0).await {
                        sprite.resize_to_width(24);
                        secondary_and_shards.push(sprite);
                    }
                }
            }
        }

        // Summoner Spells
        let sum1_asset = get_summoner_asset(player.summoner1_id, &json, &locale).await?;
        let mut sum1 = Sprite::from_asset(&sum1_asset, 0, 0).await?;
        sum1.resize_to_width(52);

        let sum2_asset = get_summoner_asset(player.summoner2_id, &json, &locale).await?;
        let mut sum2 = Sprite::from_asset(&sum2_asset, 0, 0).await?;
        sum2.resize_to_width(52);

        // Final Inventory Items (0..6 + 6 for trinket)
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
                    sprite.resize_to_width(64);
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

        // Icon Assets for Stat Cards
        let damage_icon_asset = get_stat_asset(&Stat::Damage);
        let mut damage_icon = Sprite::from_asset(&damage_icon_asset, 0, 0).await?;
        damage_icon.resize_to_width(28);

        let minion_icon_asset = get_stat_asset(&Stat::Minions);
        let mut minion_icon = Sprite::from_asset(&minion_icon_asset, 0, 0).await?;
        minion_icon.resize_to_width(28);

        let coins_icon_asset = get_stat_asset(&Stat::Golds);
        let mut coins_icon = Sprite::from_asset(&coins_icon_asset, 0, 0).await?;
        coins_icon.resize_to_width(28);

        // Localized Labels
        let is_cz = matches!(locale, AppLocale::Cz);
        let dmg_label = if is_cz { "POŠKOZENÍ A TANKOVÁNÍ" } else { "DAMAGE & TANKING" };
        let dmg_dealt_label = if is_cz { "Udělené hrdinům:" } else { "Dealt to Champs:" };
        let dmg_taken_label = if is_cz { "Obdržené poškození:" } else { "Damage Taken:" };
        let vision_title = if is_cz { "VIZE A WARDOVÁNÍ" } else { "VISION & WARDS" };
        let vision_score_label = if is_cz { "Skóre vize:" } else { "Vision Score:" };
        let wards_label = if is_cz { "Položeno / Zničeno:" } else { "Placed / Killed:" };
        let economy_title = if is_cz { "EKONOMIKA A FARMING" } else { "ECONOMY & FARMING" };
        let gold_label = if is_cz { "Získané zlato:" } else { "Gold Earned:" };
        let minion_label = if is_cz { "Farma:" } else { "Minions Killed:" };
        let p_kill_label = if is_cz { "P/Zabití" } else { "P/Kill" };
        let team_share_label = if is_cz { "z týmu" } else { "of team" };

        let multikill_str = match player.largest_multi_kill {
            5 => Some(if is_cz { "PENTAKILL" } else { "PENTAKILL" }),
            4 => Some(if is_cz { "QUADRAKILL" } else { "QUADRAKILL" }),
            3 => Some(if is_cz { "TRIPLEKILL" } else { "TRIPLEKILL" }),
            2 => Some(if is_cz { "DOUBLEKILL" } else { "DOUBLEKILL" }),
            _ => None,
        };

        // Render layout
        let canvas = canvas.with_layout(|root| {
            root
                // 1. Top Header Bar (Enlarged Profile Info)
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
                                        .size(42),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} • {} • {}",
                                        input.queue_name,
                                        format_date(input.game_creation, &locale),
                                        format_duration(input.game_duration)
                                    ))
                                    .size(26)
                                    .color(Color::Gray),
                                ),
                        ),
                )
                // 2. Outcome Banner & Multikill Badge
                .child(
                    Container::new()
                        .direction(ContainerDirection::Column)
                        .gap(6)
                        .align_items(AlignItems::Center)
                        .justify(JustifyContent::Center)
                        .child(
                            Label::new(outcome_str)
                                .bold()
                                .size(52)
                                .color(outcome_color),
                        )
                        .child_if(multikill_str.map(|mk| {
                            Label::new(mk)
                                .bold()
                                .size(24)
                                .color(Color::Rgba(255, 215, 0, 255))
                        })),
                )
                // 3. Main Champion & KDA Spotlight Card with 2 Vertical Rune Columns next to it
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
                                        .size(50),
                                )
                                .child(
                                    Label::new(format!("{:.2} KDA  |  {}: {:.0}%", kda_ratio, p_kill_label, kp_pct))
                                        .bold()
                                        .size(26)
                                        .color(Color::Rgba(0, 225, 240, 255)),
                                )
                                .child(
                                    Label::new(format!("Lvl {} {}", player.champ_level, player.champion_name))
                                        .size(24)
                                        .color(Color::Gray),
                                )
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(8)
                                        .align_items(AlignItems::Center)
                                        .child(sum1)
                                        .child(sum2),
                                ),
                        )
                        // 2 Vertical Rune Columns
                        .child(
                            Container::new()
                                .direction(ContainerDirection::Row)
                                .gap(14)
                                .align_items(AlignItems::Center)
                                // Column 1: Primary Runes (stacked top to bottom)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Column)
                                        .gap(6)
                                        .align_items(AlignItems::Center)
                                        .childs(primary_rune_sprites),
                                )
                                // Column 2: Secondary Runes & Stat Shards (stacked top to bottom)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Column)
                                        .gap(5)
                                        .align_items(AlignItems::Center)
                                        .childs(secondary_and_shards),
                                ),
                        ),
                )
                // 5. Detailed Performance Stat Cards (Full Width, Larger Fonts)
                .child(
                    Container::new()
                        .direction(ContainerDirection::Column)
                        .gap(20)
                        .width(820)
                        .child(
                            // Combat & Damage Card
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(8)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(10)
                                        .align_items(AlignItems::Center)
                                        .child(damage_icon)
                                        .child(
                                            Label::new(dmg_label)
                                                .bold()
                                                .size(26)
                                                .color(Color::Rgba(255, 90, 90, 255)),
                                        ),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} {} ({:.1}% {})",
                                        dmg_dealt_label,
                                        format_with_spaces(player.total_damage_dealt_to_champions),
                                        dmg_pct,
                                        team_share_label
                                    ))
                                    .bold()
                                    .size(24)
                                    .color(Color::White),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} {}",
                                        dmg_taken_label,
                                        format_with_spaces(player.total_damage_taken)
                                    ))
                                    .size(22)
                                    .color(Color::Gray),
                                ),
                        )
                        .child(
                            // Vision & Control Card
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(8)
                                .child(
                                    Label::new(vision_title)
                                        .bold()
                                        .size(26)
                                        .color(Color::Rgba(240, 200, 80, 255)),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} {}  |  {} {} / {}",
                                        vision_score_label,
                                        player.vision_score,
                                        wards_label,
                                        player.wards_placed,
                                        player.wards_killed
                                    ))
                                    .bold()
                                    .size(24)
                                    .color(Color::White),
                                ),
                        )
                        .child(
                            // Economy & Farming Card
                            Container::new()
                                .direction(ContainerDirection::Column)
                                .gap(8)
                                .child(
                                    Container::new()
                                        .direction(ContainerDirection::Row)
                                        .gap(10)
                                        .align_items(AlignItems::Center)
                                        .child(coins_icon)
                                        .child(
                                            Label::new(economy_title)
                                                .bold()
                                                .size(26)
                                                .color(Color::Rgba(0, 225, 120, 255)),
                                        ),
                                )
                                .child(
                                    Label::new(format!(
                                        "{} {} Gold  |  {} {} CS ({:.1} CS/min)",
                                        gold_label,
                                        format_with_spaces(player.gold_earned),
                                        minion_label,
                                        total_cs,
                                        cs_per_min
                                    ))
                                    .bold()
                                    .size(24)
                                    .color(Color::White),
                                ),
                        ),
                )
                // 6. Final Inventory Footer Row
                .child(
                    Container::new()
                        .direction(ContainerDirection::Row)
                        .gap(12)
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
