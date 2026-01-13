import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { GraphData } from '$/Worker/tasks/graph';
import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Graph', 'cyan');

const QUEUE_TYPES = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR'] as const;

export default class Graph extends AccountCommand {
    constructor() {
        super('graph', 'Show your LP graph over time', {
            me: {
                description: 'Show your LP graph',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí tvůj LP graf'
                }
            },
            name: {
                description: 'Show LP graph of another player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí LP graf jiného hráče'
                }
            },
            mention: {
                description: 'Show LP graph of mentioned player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí LP graf zmíněného hráče'
                }
            }
        });
        super.addLocalization(Locale.Czech, 'graf', 'Zobrazí LP graf');

        for (const subCommand of [
            this.meSubCommand,
            this.nameSubCommand,
            this.mentionSubCommand
        ]) {
            subCommand.addOption({
                name: 'queue',
                description: 'Queue type to show graph for (default: Solo/Duo)',
                localizedName: {
                    [Locale.Czech]: 'fronta'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Typ fronty pro zobrazení grafu (výchozí: Solo/Duo)'
                },
                type: 'STRING',
                required: false,
                choices: [
                    { name: 'Solo/Duo', value: 'RANKED_SOLO_5x5' },
                    { name: 'Flex', value: 'RANKED_FLEX_SR' }
                ]
            });
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        await this.handleAccountCommand(interaction, l);
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        DBaccount: Selectable<Account>,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);

        // Get queue from options if it's a command interaction
        let queue: (typeof QUEUE_TYPES)[number] = 'RANKED_SOLO_5x5';
        if (interaction.isChatInputCommand()) {
            const queueOption = interaction.options.getString('queue');
            if (
                queueOption &&
                QUEUE_TYPES.includes(queueOption as (typeof QUEUE_TYPES)[number])
            ) {
                queue = queueOption as (typeof QUEUE_TYPES)[number];
            }
        }

        const summoner = await api[region].summoner.byPuuid(DBaccount.puuid);
        if (!summoner.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, summoner)
            });
            return;
        }

        const account = await api[region].account.byPuuid(summoner.data.puuid);
        if (!account.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, account)
            });
            return;
        }

        const data = {
            puuid: DBaccount.puuid,
            region,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            level: summoner.data.summonerLevel,
            locale: interaction.locale,
            queue
        } satisfies GraphData;

        await interaction.deferReply();

        try {
            const result = await process.workerServer.addJobWait('graph', data);
            await interaction.editReply({
                files: [result]
            });

            await fs.unlink(result);
        } catch (e) {
            l.log(e);

            if (e instanceof Error) {
                l.error(e);
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
}
