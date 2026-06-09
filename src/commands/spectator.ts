import { AccountCommand } from '$/lib/AccountCommand';
import { getMaps, getRiotLanguageFromDiscordLocale } from '$/lib/Assets';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { getLpGain } from '$/lib/Riot/lp';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { SpectatorTaskInput } from '$/types/worker/SpectatorTaskInput';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Interaction,
    Locale,
    Message,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const l = new Logger('Spectator', 'green');

export type ButtonData = {
    discordId: string;
    puuid: string;
    region: Region;
    channelId: string;
    messageId: string;
    lastUpdate: number;
    locale: Locale;
};

export async function fetchSpectatorTaskInput(
    puuid: string,
    region: Region,
    locale: Locale
): Promise<
    | { status: false; code: number; message: string }
    | { status: true; data: SpectatorTaskInput; gameName: string; tagLine: string }
> {
    const spectator = await api[region].spectator.byPuuid(puuid);
    if (!spectator.status) {
        return { status: false, code: spectator.code, message: spectator.message };
    }

    const summoner = await api[region].summoner.byPuuid(puuid);
    if (!summoner.status) {
        return { status: false, code: summoner.code, message: summoner.message };
    }

    const account = await api[region].account.byPuuid(puuid);
    if (!account.status) {
        return { status: false, code: account.code, message: account.message };
    }

    const lang = getLocale(locale);
    const queueName =
        lang.queues[spectator.data.gameQueueConfigId as keyof typeof lang.queues] ??
        'Unknown';
    const riotLocale = getRiotLanguageFromDiscordLocale(locale);
    const maps = await getMaps(riotLocale);
    const mapName = maps?.data[spectator.data.mapId.toString()]?.MapName ?? 'Unknown';

    const data: SpectatorTaskInput = {
        puuid: puuid,
        region: region,
        locale: locale,
        queueName,
        gameLength: spectator.data.gameLength,
        participants: spectator.data.participants,
        bannedChampions: spectator.data.bannedChampions,
        mapName
    };

    return {
        status: true,
        data,
        gameName: account.data.gameName,
        tagLine: account.data.tagLine
    };
}

export async function handleMatchFinished(
    message: Message<boolean>,
    puuid: string,
    region: Region,
    locale: Locale,
    discordId: string
) {
    const lang = getLocale(locale);
    const matchIds = await api[region].match.ids(puuid, { count: 1, start: 0 });
    if (!matchIds.status || matchIds.data.length === 0) {
        throw new Error('No match found for this player.');
    }

    const matchId = matchIds.data[0];
    const matchResponse = await api[region].match.match(matchId);
    if (!matchResponse.status) {
        throw new Error('Failed to load match details.');
    }

    const matchData = matchResponse.data;
    const account = await api[region].account.byPuuid(puuid);
    const gameName = account.status ? account.data.gameName : 'Unknown';
    const tagLine = account.status ? account.data.tagLine : 'Unknown';
    const header = `<@${discordId}> ${gameName}#${tagLine} (${lang.regions[region] ?? region}):\n`;

    let result: string;
    if (matchData.isCherry) {
        result = await process.workerServer.addJobWait('cherryMatch', {
            ...matchData,
            locale,
            region,
            puuid,
            queueName: getLocale(locale).queues[matchData.info.queueId]
        });
    } else {
        const lpGain = await getLpGain(matchId, matchData.info.queueId, puuid, region);
        result = await process.workerServer.addJobWait('match', {
            ...matchData,
            locale,
            region,
            puuid,
            lpGain,
            queueName: getLocale(locale).queues[matchData.info.queueId]
        });
    }

    await message.edit({
        content: header,
        files: [result],
        components: [] // Removes reload button
    });

    await fs.unlink(result);
}

export default class Spectator extends AccountCommand {
    constructor() {
        super('spectator', 'Show information about your current game', {
            me: {
                description: 'Show information about your current game',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o tvém aktuálním zápase'
                }
            },
            name: {
                description: "Show information about another account's current game",
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o aktuálním zápase jiného účtu'
                }
            },
            mention: {
                description: "Show information about mentioned account's current game",
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o aktuálním zápase zmíněného účtu'
                }
            }
        });
        super.addLocalization(
            Locale.Czech,
            'spectator',
            'Zobrazí informace o tvém aktuálním zápase'
        );

        super.on('interactionCreate', this.onButton.bind(this));
    }

    generateButtonRow(lang: ReturnType<typeof getLocale>, key: string) {
        return new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setCustomId(`spectator;${key};reload`)
                .setEmoji('🔄')
                .setLabel(lang.spectator.reload)
                .setStyle(ButtonStyle.Primary)
        ]);
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        user: Selectable<Account>,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);
        const spectatorResult = await fetchSpectatorTaskInput(
            user.puuid,
            region,
            interaction.locale
        );

        if (!spectatorResult.status) {
            if (spectatorResult.code === 404) {
                await interaction.reply({
                    content: replacePlaceholders(
                        lang.spectator.not_in_game,
                        user.gameName,
                        user.tagLine
                    ),
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                content: replacePlaceholders(lang.genericError, spectatorResult.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const header = `<@${interaction.user.id}> ${spectatorResult.gameName}#${spectatorResult.tagLine} (${lang.regions[region] ?? region}):\n`;

        let publicMessage: Message<boolean> | undefined = undefined;
        if (
            interaction.isStringSelectMenu() &&
            interaction.channel?.isTextBased() &&
            interaction.channel.isSendable()
        ) {
            publicMessage = await interaction.channel.send({
                content: header + lang.spectator.generatingImage
            });
            await interaction.reply({
                content: lang.spectator.sentToChannel,
                flags: MessageFlags.Ephemeral
            });
            await interaction.deleteReply();
        } else {
            await interaction.deferReply();
        }

        try {
            const result = await process.workerServer.addJobWait(
                'spectator',
                spectatorResult.data
            );

            const key = crypto.randomBytes(16).toString('hex');
            const msg = publicMessage ?? (await interaction.fetchReply());

            const inMemory = process.inMemory.getInstance<ButtonData>();
            await inMemory.set('spectator:' + key, {
                discordId: interaction.user.id,
                puuid: user.puuid,
                region: region,
                channelId: msg.channelId,
                messageId: msg.id,
                lastUpdate: Date.now(),
                locale: interaction.locale
            });

            const row = this.generateButtonRow(lang, key);

            if (publicMessage) {
                await publicMessage.edit({
                    content: header,
                    files: [result],
                    components: [row]
                });
            } else {
                await interaction.editReply({
                    content: header,
                    files: [result],
                    components: [row]
                });
            }

            await fs.unlink(result);
        } catch (e) {
            l.error(e);
            if (e instanceof Error) {
                const content = header + replacePlaceholders(lang.workerError, e.message);
                if (publicMessage) {
                    await publicMessage.edit({ content });
                } else {
                    await interaction.editReply({ content });
                }

                process.discordBot.handleError(e, interaction);
                return;
            }

            const content = header + lang.genericError;
            if (publicMessage) {
                await publicMessage.edit({ content });
            } else {
                await interaction.editReply({ content });
            }

            process.discordBot.handleError(e, interaction);
            return;
        }
    }

    async onButton(interaction: Interaction) {
        if (!interaction.isButton()) return;

        const id = interaction.customId.split(';');
        if (id[0] !== 'spectator') return;

        const lang = getLocale(interaction.locale);
        const key = id[1];

        const inMemory = process.inMemory.getInstance<ButtonData>();
        const data = await inMemory.get('spectator:' + key);

        if (!data) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }

        if (interaction.user.id !== data.discordId) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.noPermission
            });
            return;
        }

        const spectatorResult = await fetchSpectatorTaskInput(
            data.puuid,
            data.region,
            interaction.locale
        );

        if (!spectatorResult.status) {
            if (spectatorResult.code === 404) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                try {
                    await handleMatchFinished(
                        interaction.message,
                        data.puuid,
                        data.region,
                        interaction.locale,
                        data.discordId
                    );
                    await inMemory.delete('spectator:' + key);
                    await interaction.deleteReply();
                } catch (e) {
                    l.error(e);
                    await interaction.editReply({ content: lang.genericError });
                    process.discordBot.handleError(e, interaction);
                }
                return;
            }

            await interaction.reply({
                content: replacePlaceholders(lang.genericError, spectatorResult.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            const result = await process.workerServer.addJobWait(
                'spectator',
                spectatorResult.data
            );

            const row = this.generateButtonRow(lang, key);

            await interaction.message.edit({
                files: [result],
                components: [row]
            });

            await inMemory.set('spectator:' + key, {
                ...data,
                lastUpdate: Date.now()
            });

            await interaction.deleteReply();
            await fs.unlink(result);
        } catch (e) {
            l.error(e);
            if (e instanceof Error) {
                await interaction.editReply({
                    content: replacePlaceholders(lang.workerError, e.message)
                });

                process.discordBot.handleError(e, interaction);
                return;
            }
            await interaction.editReply({
                content: lang.genericError
            });

            process.discordBot.handleError(e, interaction);
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        super.handleAccountCommand(interaction, l);
    }
}
