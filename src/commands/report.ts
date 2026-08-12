import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { recordMatchDataAndDuoPairs } from '$/lib/Riot/duo';
import { ParticipantSchema } from '$/lib/Riot/schemes';
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
    StringSelectMenuOptionBuilder,
    TextChannel
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

        await interaction.deferReply();

        const selectedMatchId = interaction.values[0];
        const { puuid, region } = data;

        const matchData = await api[region].match.match(selectedMatchId);
        if (!matchData.status) {
            const lang = getLocale(interaction.locale);
            await interaction.editReply({
                content: formatErrorResponse(lang, matchData)
            });
            return;
        }

        const summoner = await api[region].summoner.byPuuid(puuid);
        if (!summoner.status) {
            const lang = getLocale(interaction.locale);
            await interaction.editReply({
                content: formatErrorResponse(lang, summoner)
            });
            return;
        }

        const account = await api[region].account.byPuuid(puuid);
        if (!account.status) {
            const lang = getLocale(interaction.locale);
            await interaction.editReply({
                content: formatErrorResponse(lang, account)
            });
            return;
        }

        const info = matchData.data.info;
        const participant = info.participants.find((p: Participant) => p.puuid === puuid);

        if (!participant) {
            const lang = getLocale(interaction.locale);
            await interaction.editReply({
                content: lang.match.empty
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
                totalMinionsKilled: participant.totalMinionsKilled,
                visionScore: participant.visionScore,
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
            teamTotalKills
        };

        const resultPath = await process.workerServer.addJobWait('report', payload);

        const buffer = await fs.readFile(resultPath);

        const textChannel = interaction.channel as TextChannel | null;
        let channelMessage;
        if (textChannel && typeof textChannel.send === 'function') {
            channelMessage = await textChannel.send({
                files: [
                    {
                        attachment: buffer,
                        name: 'report.png'
                    }
                ]
            });
        }

        if (channelMessage) {
            await interaction.editReply({
                content: replacePlaceholders(
                    lang.report.sentToChannel,
                    channelMessage.url
                )
            });
        } else {
            await interaction.editReply({
                files: [
                    {
                        attachment: buffer,
                        name: 'report.png'
                    }
                ]
            });
        }

        await fs.unlink(resultPath);
    }
}
