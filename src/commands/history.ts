import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { getMatchTeamIndicators, recordMatchDataAndDuoPairs } from '$/lib/Riot/duo';
import { getLpDetails } from '$/lib/Riot/lp';
import { CherryMatchSchema, MatchSchema } from '$/lib/Riot/schemes';
import { evaluatePlayerTags } from '$/lib/Riot/tags';
import { queues, Region } from '$/lib/Riot/types';
import { getMatchStatus, MatchStatus } from '$/lib/Riot/utilities';
import { canSendToChannel } from '$/lib/utilities';
import { Account } from '$/types/database';
import type { MatchTaskInput } from '$/types/worker/MatchTaskInput';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    ContainerBuilder,
    Interaction,
    Locale,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    Message,
    MessageFlags,
    RepliableInteraction,
    SectionBuilder,
    TextDisplayBuilder
} from 'discord.js';
import { Selectable } from 'kysely';
import crypto from 'node:crypto';
import type { z } from 'zod';
import { generateReport } from './report';

const l = new Logger('History', 'white');

type MatchData = z.infer<typeof MatchSchema>;
type CherryMatchData = z.infer<typeof CherryMatchSchema>;

export type HistoryMatchInfo = {
    matchId: string;
    isCherry: boolean;
    win: boolean;
    isRemake: boolean;
    queueName: string;
    gameDuration: number;
    gameStartTimestamp: number;
};

type ButtonData = {
    discordId: string;
    puuid: string;
    region: Region;
    queue: string | null;
    count: number;
    offset: number;
    header: string;
    matchIds: string[];
};

type CustomData = {
    queue: string | null;
    count: number;
    offset: number;
};

export default class History extends AccountCommand<CustomData> {
    constructor() {
        super(
            'history',
            'Show you match history of last 6 games',
            {
                me: {
                    description: 'Show your match history of last 6 games',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí tvou historii posledních 6 her'
                    }
                },
                name: {
                    description: 'Show match history of another player',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí historii her jiného hráče'
                    }
                },
                mention: {
                    description: 'Show match history of mentioned player',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí historii her zmíněného hráče'
                    }
                }
            },
            {
                exampleUsage: {
                    default: '/history me - show your match history',
                    locales: {
                        [Locale.Czech]:
                            '/historie já - zobrazí tvou historii posledních 6 her'
                    }
                }
            }
        );
        super.addLocalization(
            Locale.Czech,
            'historie',
            'Zobrazí tvou historii posledních 6 her'
        );
        for (const subCommand of [
            this.meSubCommand,
            this.nameSubCommand,
            this.mentionSubCommand
        ]) {
            subCommand.addOption({
                name: 'queue',
                description: 'Select queue for filtering',
                localizedName: {
                    [Locale.Czech]: 'fronta'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Výběr fronty pro filtrování'
                },
                type: 'STRING',
                required: false,
                autocomplete: true
            });
            subCommand.addOption({
                name: 'count',
                description: 'Number of games to show at once',
                localizedName: {
                    [Locale.Czech]: 'počet'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Počet her, které se zobrazí najednou'
                },
                type: 'INTEGER',
                required: false,
                min: 1,
                max: 6
            });
            subCommand.addOption({
                name: 'offset',
                description: 'Number of games to skip',
                localizedName: {
                    [Locale.Czech]: 'posun'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Počet her, které se přeskočí'
                },
                type: 'INTEGER',
                required: false
            });
        }

        super.on('interactionCreate', this.autocomplete);
        super.on('interactionCreate', this.onButton);
        super.on('interactionCreate', this.clashTeamButton);
    }

    async clashTeamButton(interaction: Interaction) {
        if (!interaction.isButton()) return;

        const id = interaction.customId.split(';');
        if (id[0] !== 'clhis') return;
        await this.onMenuSelect(
            interaction as RepliableInteraction<CacheType>,
            {
                puuid: id[1],
                region: id[2]
            } as Selectable<Account>,
            id[2] as Region,
            {
                queue: queues
                    .find((q) => q.description === "Summoner's Rift Clash games")!
                    .queueId.toString(),
                count: 6,
                offset: 0
            }
        );
    }

    async getFiles(
        locale: Locale,
        region: Region,
        puuid: string,
        queue: string | null,
        count: number,
        offset: number
    ) {
        const lang = getLocale(locale);

        const matchIds = await api[region].match.ids(puuid, {
            start: offset,
            count,
            queue: queue || undefined
        });

        if (!matchIds.status) {
            return formatErrorResponse(lang, matchIds);
        }

        if (matchIds.data.length === 0) {
            return lang.match.empty;
        }

        const matchPromises = matchIds.data.map((matchId) =>
            api[region].match.match(matchId)
        );
        const timelinePromises = matchIds.data.map((matchId) =>
            api[region].match.timeline(matchId)
        );

        const [matchesData, timelinesData] = await Promise.all([
            Promise.all(matchPromises),
            Promise.all(timelinePromises)
        ]);

        if (matchesData.some((match) => !match.status)) {
            return formatErrorResponse(lang, matchesData.find((match) => !match.status)!);
        }

        const matchesInfo: HistoryMatchInfo[] = [];

        const jobIds = await Promise.all(
            matchesData.map(async (matchResponse, index) => {
                if (!matchResponse.status) {
                    throw new Error('Unexpected match response status');
                }

                const matchData: MatchData = matchResponse.data;

                let jobId: string;
                if (matchData.isCherry) {
                    const cherryMatchData: CherryMatchData = matchData;
                    const participant = cherryMatchData.info.participants.find(
                        (p) => p.puuid === puuid
                    );
                    const win = participant
                        ? participant.subteamPlacement <= 2 || (participant.win ?? false)
                        : false;

                    matchesInfo[index] = {
                        matchId: cherryMatchData.metadata.matchId,
                        isCherry: true,
                        win,
                        isRemake: false,
                        queueName:
                            getLocale(locale).queues[cherryMatchData.info.queueId] ??
                            'Arena',
                        gameDuration: cherryMatchData.info.gameDuration,
                        gameStartTimestamp: Number(
                            cherryMatchData.info.gameStartTimestamp
                        )
                    };

                    jobId = process.workerServer.addJob('cherryMatch', {
                        ...cherryMatchData,
                        locale,
                        region,
                        puuid,
                        queueName: getLocale(locale).queues[cherryMatchData.info.queueId]
                    });
                } else {
                    const regularMatchData = matchData;

                    // Record detailed match participant stats & duo pairs in database
                    await recordMatchDataAndDuoPairs(regularMatchData);

                    const [lpDetails, teamsMap] = await Promise.all([
                        getLpDetails(
                            regularMatchData.metadata.matchId,
                            regularMatchData.info.queueId,
                            puuid,
                            region
                        ),
                        getMatchTeamIndicators(regularMatchData)
                    ]);

                    const timelineResponse = timelinesData[index];
                    const timelineData =
                        timelineResponse && timelineResponse.status
                            ? timelineResponse.data
                            : null;

                    const participantsWithTags = regularMatchData.info.participants.map(
                        (participant) => {
                            const tags = evaluatePlayerTags(
                                participant,
                                regularMatchData,
                                timelineData,
                                locale
                            );

                            return {
                                ...participant,
                                tags
                            };
                        }
                    );

                    let win = false;
                    let isRemake = false;
                    try {
                        const status = getMatchStatus(regularMatchData, puuid);
                        win = status === MatchStatus.Win;
                        isRemake = status === MatchStatus.Remake;
                    } catch {
                        const participant = regularMatchData.info.participants.find(
                            (p) => p.puuid === puuid
                        );
                        win = participant?.win ?? false;
                        isRemake = participant?.gameEndedInEarlySurrender ?? false;
                    }

                    matchesInfo[index] = {
                        matchId: regularMatchData.metadata.matchId,
                        isCherry: false,
                        win,
                        isRemake,
                        queueName:
                            getLocale(locale).queues[regularMatchData.info.queueId] ??
                            'Custom',
                        gameDuration: regularMatchData.info.gameDuration,
                        gameStartTimestamp: Number(
                            regularMatchData.info.gameStartTimestamp
                        )
                    };

                    const payload: MatchTaskInput = {
                        ...regularMatchData,
                        info: {
                            ...regularMatchData.info,
                            participants: participantsWithTags
                        },
                        locale,
                        region,
                        puuid,
                        lpGain: lpDetails.gain,
                        tierChange: lpDetails.tierChange || undefined,
                        teams: Object.keys(teamsMap).length > 0 ? teamsMap : undefined,
                        queueName: getLocale(locale).queues[regularMatchData.info.queueId]
                    };

                    jobId = process.workerServer.addJob('match', payload);
                }

                return jobId;
            })
        );

        return {
            jobIds,
            matchesInfo
        };
    }

    generateButtonRow(
        lang: ReturnType<typeof getLocale>,
        key: string,
        count: number,
        offset: number,
        promiseCount: number
    ) {
        return new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setCustomId(`history;${key};prev`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(offset === 0),
            new ButtonBuilder()
                .setCustomId(`history;${key};reload`)
                .setEmoji('🔄')
                .setLabel(
                    replacePlaceholders(
                        lang.match.buttonInfoText,
                        offset.toString(),
                        (offset + count).toString()
                    )
                )
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`history;${key};next`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(promiseCount < count) // I am at the end
        ]);
    }

    private async handleMessages(
        editMessage: Message<boolean> | RepliableInteraction<CacheType>,
        interaction: RepliableInteraction<CacheType>,
        jobIds: string[],
        matchesInfo: HistoryMatchInfo[],
        row: ActionRowBuilder<ButtonBuilder>,
        lang: ReturnType<typeof getLocale>,
        contentPrefix: string,
        key: string
    ) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({
                flags: editMessage instanceof Message ? MessageFlags.Ephemeral : undefined
            });
        }

        try {
            const files = await Promise.all(
                jobIds.map((jobId) => process.workerServer.wait(jobId))
            );

            const attachments = files.map((file, i) => ({
                attachment: file,
                name: `match_${i}.png`
            }));

            const components: (
                | ContainerBuilder
                | ActionRowBuilder<ButtonBuilder>
                | TextDisplayBuilder
            )[] = [];

            if (contentPrefix.trim()) {
                components.push(
                    new TextDisplayBuilder().setContent(contentPrefix.trim())
                );
            }

            for (let i = 0; i < matchesInfo.length; i++) {
                const info = matchesInfo[i];
                const attachmentName = `match_${i}.png`;

                const accentColor = info.isRemake
                    ? 0x785a28
                    : info.win
                      ? 0x0ac8b9
                      : 0xe84057;

                const container = new ContainerBuilder()
                    .setAccentColor(accentColor)
                    .addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(
                                `attachment://${attachmentName}`
                            )
                        )
                    );

                const minutes = Math.floor(info.gameDuration / 60);
                const seconds = info.gameDuration % 60;
                const durationStr = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

                const resultText = info.isRemake
                    ? (lang.match.results[MatchStatus.Remake] ?? 'Remake')
                    : info.win
                      ? (lang.match.results[MatchStatus.Win] ?? 'Victory')
                      : (lang.match.results[MatchStatus.Loss] ?? 'Defeat');

                const headerContent = `### ${resultText} • ${info.queueName}\n-# ${durationStr} • <t:${Math.floor(info.gameStartTimestamp / 1000)}:R>`;

                if (!info.isCherry) {
                    const section = new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(headerContent)
                        )
                        .setButtonAccessory(
                            new ButtonBuilder()
                                .setCustomId(`history;${key};report;${i}`)
                                .setLabel(lang.match.report ?? 'Report')
                                .setEmoji('📊')
                                .setStyle(ButtonStyle.Secondary)
                        );
                    container.addSectionComponents(section);
                } else {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(headerContent)
                    );
                }

                components.push(container);
            }

            components.push(row);

            const payload = {
                flags: MessageFlags.IsComponentsV2 as const,
                files: attachments,
                components
            };

            if (editMessage instanceof Message) {
                await editMessage.edit(payload);
                if (interaction.deferred) await interaction.deleteReply();
            } else {
                await editMessage.editReply(payload);
            }
        } catch (e) {
            jobIds.forEach((jobId) => process.workerServer.removeJob(jobId));

            const content =
                contentPrefix +
                (e instanceof Error
                    ? replacePlaceholders(lang.workerError, e.message)
                    : lang.genericError);

            const payload = {
                flags: MessageFlags.IsComponentsV2 as const,
                components: [new TextDisplayBuilder().setContent(content)]
            };

            if (editMessage instanceof Message) {
                await editMessage.edit(payload);
            } else {
                await interaction.editReply(payload);
            }

            process.discordBot.handleError(e, interaction);
        }
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        account: Selectable<Account>,
        region: Region,
        customData: CustomData
    ) {
        const lang = getLocale(interaction.locale);
        const { queue, count, offset } = customData;
        const header = `<@${interaction.user.id}> ${account.gameName}#${account.tagLine} (${lang.regions[region] ?? region}):\n`;

        let publicMessage: Message<boolean> | undefined = undefined;
        if (interaction.isStringSelectMenu() && canSendToChannel(interaction)) {
            try {
                publicMessage = await interaction.channel.send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [
                        new TextDisplayBuilder().setContent(
                            header +
                                replacePlaceholders(
                                    lang.match.loading,
                                    '0',
                                    customData.count.toString()
                                )
                        )
                    ]
                });
                await interaction.reply({
                    content: lang.match.sentToChannel,
                    flags: MessageFlags.Ephemeral
                });
                await interaction.deleteReply();
            } catch {
                publicMessage = undefined;
                await interaction.deferReply();
            }
        } else {
            await interaction.deferReply();
        }

        const result = await this.getFiles(
            interaction.locale,
            region,
            account.puuid,
            queue,
            count,
            offset
        );

        if (typeof result === 'string') {
            const payload = {
                flags: MessageFlags.IsComponentsV2 as const,
                components: [new TextDisplayBuilder().setContent(header + result)]
            };
            if (publicMessage) {
                await publicMessage.edit(payload);
            } else {
                await interaction.editReply(payload);
            }
            return;
        }

        const key = crypto.randomBytes(16).toString('hex');

        const inMemory = process.inMemory.getInstance<ButtonData>();
        await inMemory.set(key, {
            discordId: interaction.user.id,
            puuid: account.puuid,
            region,
            queue: queue || '',
            count,
            offset,
            header,
            matchIds: result.matchesInfo.map((m) => m.matchId)
        });

        const row = this.generateButtonRow(
            lang,
            key,
            count,
            offset,
            result.jobIds.length
        );

        if (publicMessage) {
            await this.handleMessages(
                publicMessage,
                interaction,
                result.jobIds,
                result.matchesInfo,
                row,
                lang,
                header,
                key
            );
        } else {
            await this.handleMessages(
                interaction,
                interaction,
                result.jobIds,
                result.matchesInfo,
                row,
                lang,
                header,
                key
            );
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const queue = interaction.options.getString('queue');
        const count = interaction.options.getInteger('count') || 6;
        const offset = interaction.options.getInteger('offset') || 0;

        await this.handleAccountCommand(interaction, l, {
            queue,
            count,
            offset
        });
    }

    async autocomplete(interaction: Interaction) {
        if (!interaction.isAutocomplete()) return;
        if (interaction.commandName !== 'history') return;

        const lang = getLocale(interaction.locale);

        const option = interaction.options.getFocused(true);

        const options = queues
            .map((queue) => {
                return {
                    name: lang.queues[queue.queueId],
                    value: queue.queueId.toString()
                };
            })
            .filter((opt) => opt.name.toLowerCase().includes(option.value.toLowerCase()));

        await interaction.respond(options.slice(0, 25));
    }

    async onButton(interaction: Interaction) {
        if (!interaction.isButton()) return;
        //history;discordid;summonerid;region;queue;count;offset
        const id = interaction.customId.split(';');
        if (id[0] !== 'history') return;

        const lang = getLocale(interaction.locale);
        const key = id[1];

        const inMemory = process.inMemory.getInstance<ButtonData>();
        const data = await inMemory.get(key);

        if (!data) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }

        const command = id[2];

        if (command === 'report') {
            const index = parseInt(id[3], 10);
            const matchId = data.matchIds?.[index];
            if (!matchId) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: lang.match.empty
                });
                return;
            }
            await generateReport(interaction, data.puuid, data.region, matchId);
            return;
        }

        if (interaction.user.id !== data.discordId) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.noPermission
            });
            return;
        }

        let { offset } = data;
        const { count, puuid, region, queue, header } = data;

        const originalOffset = offset;

        switch (command) {
            case 'prev':
                offset -= count;
                break;
            case 'next':
                offset += count;
                break;
            case 'reload':
                break;
        }

        //clamp offset to 0
        offset = Math.max(0, offset);

        const account = await api[region].summoner.byPuuid(puuid);
        if (!account.status) return;

        const result = await this.getFiles(
            interaction.locale,
            region,
            puuid,
            queue,
            count,
            offset
        );
        if (typeof result === 'string') {
            if (result === lang.match.empty) {
                //update buttons, so the next button is disabled
                const row = this.generateButtonRow(lang, key, count, originalOffset, 0);

                const existingComponents = interaction.message.components
                    .slice(0, -1)
                    .map((c) => c.toJSON());
                await interaction.message.edit({
                    components: [...existingComponents, row]
                });
            }

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: result
            });
            return;
        }

        //update in memory
        await inMemory.set(key, {
            discordId: interaction.user.id,
            puuid: account.data.puuid,
            region,
            queue: queue || '',
            count,
            offset,
            header,
            matchIds: result.matchesInfo.map((m) => m.matchId)
        });

        const row = this.generateButtonRow(
            lang,
            key,
            count,
            offset,
            result.jobIds.length
        );

        await this.handleMessages(
            interaction.message,
            interaction,
            result.jobIds,
            result.matchesInfo,
            row,
            lang,
            header,
            key
        );
    }
}
