import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { SpectatorData } from '$/Worker/tasks/spectator';
import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Spectator', 'green');

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
            await interaction.editReply({
                files: [result]
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

    async handler(interaction: ChatInputCommandInteraction) {
        super.handleAccountCommand(interaction, l);
    }
}
