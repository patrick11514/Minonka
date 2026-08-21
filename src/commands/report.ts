import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { recordMatchDataAndDuoPairs } from '$/lib/Riot/duo';
import { ParticipantSchema } from '$/lib/Riot/schemes';
import { evaluatePlayerTags } from '$/lib/Riot/tags';
import { queues, Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { ReportTaskInput } from '$/types/worker/ReportTaskInput';
import {
    ActionRowBuilder,
    CacheType,
    ChatInputCommandInteraction,
    Interaction,
    Locale,
    MessageFlags,
    RepliableInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { Selectable } from 'kysely';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { z } from 'zod';

type Participant = z.infer<typeof ParticipantSchema>;

const l = new Logger('Report', 'magenta');

type SelectMenuData = {
    discordId: string;
    puuid: string;
    region: Region;
};

export default class Report extends AccountCommand<undefined> {
    constructor() {
        super(
            'report',
            'Generate detailed 3:4 match performance report card',
            {
                me: {
                    description: 'Generate report card for your recent match',
                    localizedDescription: {
                        [Locale.Czech]: 'Vygeneruje report kartu pro tvůj nedávný zápas'
                    }
                },
                name: {
                    description: 'Generate report card for another player',
                    localizedDescription: {
                        [Locale.Czech]: 'Vygeneruje report kartu pro jiného hráče'
                    }
                },
                mention: {
                    description: 'Generate report card for mentioned player',
                    localizedDescription: {
                        [Locale.Czech]: 'Vygeneruje report kartu pro zmíněného hráče'
                    }
                }
            },
            {
                exampleUsage: {
                    default:
                        '/report me - Select a recent game to generate a report card',
                    locales: {
                        [Locale.Czech]:
                            '/report já - Vyberte nedávný zápas pro vygenerování karty'
                    }
                }
            }
        );
        super.addLocalization(
            Locale.Czech,
            'report',
            'Vygeneruje detailní report kartu zápasu'
        );

        super.on('interactionCreate', this.onSelectMenu.bind(this));
    }

    async handler(interaction: ChatInputCommandInteraction) {
        await this.handleAccountCommand(interaction, l);
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        account: Selectable<Account>,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);

        await interaction.deferReply();

        const matchIds = await api[region].match.ids(account.puuid, { count: 10 });
        if (!matchIds.status || matchIds.data.length === 0) {
            await interaction.editReply({
                content: matchIds.status
                    ? lang.match.empty
                    : formatErrorResponse(lang, matchIds)
            });
            return;
        }

        const matchSummaries: {
            matchId: string;
            label: string;
            description: string;
        }[] = [];

        for (const matchId of matchIds.data) {
            const matchData = await api[region].match.match(matchId);
            if (!matchData.status) continue;

            // Save match participant statistics & duo pairs
            await recordMatchDataAndDuoPairs(matchData.data);

            const participant = matchData.data.info.participants.find(
                (p: Participant) => p.puuid === account.puuid
            );
            if (!participant) continue;

            const queue = queues.find((q) => q.queueId === matchData.data.info.queueId);
            const queueName = queue
                ? (lang.queues[queue.queueId as keyof typeof lang.queues] ??
                  queue.description)
                : 'Custom';

            const date = new Date(matchData.data.info.gameCreation);
            const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')} ${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;

            const outcome = participant.win ? 'Win' : 'Loss';
            const kdaStr = `${participant.kills}/${participant.deaths}/${participant.assists}`;

            matchSummaries.push({
                matchId,
                label: `${queueName} • ${timeStr}`,
                description: `${participant.championName} - ${outcome} (${kdaStr})`
            });
        }

        if (matchSummaries.length === 0) {
            await interaction.editReply({
                content: lang.match.empty
            });
            return;
        }

        const key = crypto.randomBytes(16).toString('hex');
        const inMemory = process.inMemory.getInstance<SelectMenuData>();
        await inMemory.set(key, {
            discordId: interaction.user.id,
            puuid: account.puuid,
            region
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`report_game;${key}`)
            .setPlaceholder(lang.report.selectPlaceholder)
            .addOptions(
                matchSummaries.map((item) =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(item.label)
                        .setDescription(item.description)
                        .setValue(item.matchId)
                )
            );

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            selectMenu
        );

        await interaction.editReply({
            content: lang.report.selectPlaceholder,
            components: [row]
        });
    }

    async onSelectMenu(interaction: Interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const parts = interaction.customId.split(';');
        if (parts[0] !== 'report_game') return;

        const key = parts[1];
        const inMemory = process.inMemory.getInstance<SelectMenuData>();
        const data = await inMemory.get(key);

        if (!data) return;

        if (data.discordId !== interaction.user.id) {
            const lang = getLocale(interaction.locale);
            await interaction.reply({
                content: lang.noPermission,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferUpdate();

        const selectedMatchId = interaction.values[0];
        const { puuid, region } = data;

        const matchData = await api[region].match.match(selectedMatchId);
        if (!matchData.status) {
            const lang = getLocale(interaction.locale);
            await interaction.followUp({
                content: formatErrorResponse(lang, matchData),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const summoner = await api[region].summoner.byPuuid(puuid);
        if (!summoner.status) {
            const lang = getLocale(interaction.locale);
            await interaction.followUp({
                content: formatErrorResponse(lang, summoner),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const account = await api[region].account.byPuuid(puuid);
        if (!account.status) {
            const lang = getLocale(interaction.locale);
            await interaction.followUp({
                content: formatErrorResponse(lang, account),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const info = matchData.data.info;
        const participant = info.participants.find((p: Participant) => p.puuid === puuid);

        if (!participant) {
            const lang = getLocale(interaction.locale);
            await interaction.followUp({
                content: lang.match.empty,
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const teamParticipants = info.participants.filter(
            (p: Participant) => p.teamId === participant.teamId
        );
        const teamTotalDamage = teamParticipants.reduce(
            (sum: number, p: Participant) => sum + p.totalDamageDealtToChampions,
            0
        );
        const teamTotalKills = teamParticipants.reduce(
            (sum: number, p: Participant) => sum + p.kills,
            0
        );

        const lang = getLocale(interaction.locale);
        const queue = queues.find((q) => q.queueId === info.queueId);
        const queueName = queue
            ? (lang.queues[queue.queueId as keyof typeof lang.queues] ??
              queue.description)
            : 'Custom';

        const timelineData = await api[region].match.timeline(selectedMatchId);
        const timelineItems: Array<{
            itemId: number;
            timestamp: number;
            isSold: boolean;
        }> = [];
        const timelineWards: Array<{ wardType: string; timestamp: number }> = [];

        if (timelineData.status && timelineData.data.info) {
            const timelineParticipant = timelineData.data.info.participants.find(
                (p) => p.puuid === puuid
            );
            const participantId = timelineParticipant?.participantId;

            if (participantId !== undefined) {
                for (const frame of timelineData.data.info.frames) {
                    for (const event of frame.events) {
                        if (event.participantId === participantId) {
                            if (event.type === 'ITEM_PURCHASED' && event.itemId) {
                                timelineItems.push({
                                    itemId: event.itemId,
                                    timestamp: Math.floor(event.timestamp / 1000),
                                    isSold: false
                                });
                            } else if (event.type === 'ITEM_SOLD' && event.itemId) {
                                timelineItems.push({
                                    itemId: event.itemId,
                                    timestamp: Math.floor(event.timestamp / 1000),
                                    isSold: true
                                });
                            }
                        } else if (
                            event.creatorId === participantId &&
                            event.type === 'WARD_PLACED' &&
                            event.wardType
                        ) {
                            timelineWards.push({
                                wardType: event.wardType,
                                timestamp: Math.floor(event.timestamp / 1000)
                            });
                        }
                    }
                }
            }
        }

        // Tag Evaluation
        const tags = evaluatePlayerTags(
            participant,
            matchData.data,
            timelineData.status ? timelineData.data : null,
            interaction.locale
        );

        const payload: ReportTaskInput = {
            puuid,
            region,
            locale: interaction.locale,
            level: summoner.data.summonerLevel,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            metadata: {
                matchId: selectedMatchId
            },
            queueName,
            gameCreation: BigInt(info.gameCreation),
            gameDuration: info.gameDuration,
            participant: {
                assists: participant.assists,
                champLevel: participant.champLevel,
                championName: participant.championName,
                deaths: participant.deaths,
                gameEndedInEarlySurrender: participant.gameEndedInEarlySurrender,
                goldEarned: participant.goldEarned,
                kills: participant.kills,
                item0: participant.item0,
                item1: participant.item1,
                item2: participant.item2,
                item3: participant.item3,
                item4: participant.item4,
                item5: participant.item5,
                item6: participant.item6,
                puuid: participant.puuid,
                riotIdGameName: participant.riotIdGameName,
                riotIdTagline: participant.riotIdTagline,
                roleBoundItem: participant.roleBoundItem ?? null,
                summoner1Id: participant.summoner1Id,
                summoner2Id: participant.summoner2Id,
                teamId: participant.teamId,
                totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
                totalDamageTaken: participant.totalDamageTaken ?? 0,
                totalMinionsKilled: participant.totalMinionsKilled,
                visionScore: participant.visionScore,
                wardsPlaced: participant.wardsPlaced ?? 0,
                wardsKilled: participant.wardsKilled ?? 0,
                largestMultiKill: participant.largestMultiKill ?? 0,
                win: participant.win,
                perks: {
                    statPerks: participant.perks.statPerks
                        ? {
                              defense: participant.perks.statPerks.defense,
                              flex: participant.perks.statPerks.flex,
                              offense: participant.perks.statPerks.offense
                          }
                        : undefined,
                    styles: participant.perks.styles.map((style) => ({
                        description: style.description,
                        style: style.style,
                        selections: style.selections.map((sel) => ({
                            perk: sel.perk,
                            var1: sel.var1,
                            var2: sel.var2,
                            var3: sel.var3
                        }))
                    }))
                }
            },
            teamTotalDamage,
            teamTotalKills,
            timelineItems,
            timelineWards,
            tags
        };

        const resultPath = await process.workerServer.addJobWait('report', payload);

        const buffer = await fs.readFile(resultPath);

        await interaction.editReply({
            content: '',
            files: [
                {
                    attachment: buffer,
                    name: 'report.png'
                }
            ],
            components: interaction.message.components
        });

        // Delete temporary file only if it was in the temp directory (not cached persistent)
        if (resultPath.includes('/tmp') || resultPath.includes('output_')) {
            await fs.unlink(resultPath).catch(() => {});
        }
    }
}
