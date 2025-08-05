import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { SpectatorData } from '$/Worker/tasks/spectator';
import crypto from 'node:crypto';
import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    MessageFlags,
    RepliableInteraction,
    Interaction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Spectator', 'green');

type ButtonData = {
    discordId: string;
    puuid: string;
    region: Region;
    level: number;
    gameName: string;
    tagLine: string;
    profileIconId: number;
    locale: Locale;
};

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

        super.on('interactionCreate', this.onButton);
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
        const spectator = await api[region].spectator.byPuuid(user.puuid);

        if (!spectator.status) {
            if (spectator.code === 404) {
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
                content: replacePlaceholders(lang.genericError, spectator.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const summoner = await api[region].summoner.byPuuid(user.puuid);
        if (!summoner.status) {
            await interaction.reply({
                content: replacePlaceholders(lang.genericError, summoner.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const account = await api[region].account.byPuuid(summoner.data.puuid);
        if (!account.status) {
            await interaction.reply({
                content: replacePlaceholders(lang.genericError, account.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        const data = {
            puuid: summoner.data.puuid,
            region: region,
            level: summoner.data.summonerLevel,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            locale: interaction.locale,
            queueId: spectator.data.gameQueueConfigId,
            gameLength: spectator.data.gameLength,
            participants: spectator.data.participants,
            mapId: spectator.data.mapId
        } satisfies SpectatorData;

        await interaction.deferReply();

        try {
            const result = await process.workerServer.addJobWait('spectator', data);

            const key = crypto.randomBytes(16).toString('hex');
            const inMemory = process.inMemory.getInstance<ButtonData>();
            inMemory.set(key, {
                discordId: interaction.user.id,
                puuid: summoner.data.puuid,
                region: region,
                level: summoner.data.summonerLevel,
                gameName: account.data.gameName,
                tagLine: account.data.tagLine,
                profileIconId: summoner.data.profileIconId,
                locale: interaction.locale
            });

            const row = this.generateButtonRow(lang, key);

            await interaction.editReply({
                files: [result],
                components: [row]
            });

            await fs.unlink(result);
        } catch (e) {
            l.error(e);
            if (e instanceof Error) {
                await interaction.editReply({
                    content: replacePlaceholders(lang.workerError, e.message)
                });
                return;
            }
            await interaction.editReply({
                content: lang.genericError
            });
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
        const data = await inMemory.get(key);

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

        // Check if user is still in game
        const spectator = await api[data.region].spectator.byPuuid(data.puuid);

        if (!spectator.status) {
            if (spectator.code === 404) {
                await interaction.reply({
                    content: replacePlaceholders(
                        lang.spectator.not_in_game,
                        data.gameName,
                        data.tagLine
                    ),
                    flags: MessageFlags.Ephemeral
                });
                return;
            }

            await interaction.reply({
                content: replacePlaceholders(lang.genericError, spectator.message),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            // Create spectator data using stored user info and fresh game data
            const spectatorData = {
                puuid: data.puuid,
                region: data.region,
                level: data.level,
                gameName: data.gameName,
                tagLine: data.tagLine,
                profileIconId: data.profileIconId,
                locale: data.locale,
                queueId: spectator.data.gameQueueConfigId,
                gameLength: spectator.data.gameLength,
                participants: spectator.data.participants,
                mapId: spectator.data.mapId
            } satisfies SpectatorData;

            const result = await process.workerServer.addJobWait(
                'spectator',
                spectatorData
            );

            const row = this.generateButtonRow(lang, key);

            await interaction.message.edit({
                files: [result],
                components: [row]
            });

            await interaction.deleteReply();
            await fs.unlink(result);
        } catch (e) {
            l.error(e);
            if (e instanceof Error) {
                await interaction.editReply({
                    content: replacePlaceholders(lang.workerError, e.message)
                });
                return;
            }
            await interaction.editReply({
                content: lang.genericError
            });
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        super.handleAccountCommand(interaction, l);
    }
}
