import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import { _Rank, _Tier, Region } from '$/lib/Riot/types';
import { conn } from '$/types/connection';
import { Account } from '$/types/database';
import { GraphData } from '$/Worker/tasks/graph';
import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Graph', 'cyan');

type CustomData = {
    queue: string;
};

export default class Graph extends AccountCommand<CustomData> {
    constructor() {
        super(
            'graph',
            'Show LP history graph',
            {
                me: {
                    description: 'Show your LP history graph',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí graf tvé historie LP'
                    }
                },
                name: {
                    description: 'Show LP history graph of another player',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí graf historie LP jiného hráče'
                    }
                },
                mention: {
                    description: 'Show LP history graph of mentioned player',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí graf historie LP zmíněného hráče'
                    }
                }
            },
            {
                exampleUsage: {
                    default: '/graph me - show your LP history graph',
                    locales: {
                        [Locale.Czech]: '/graf já - zobrazí graf tvé historie LP'
                    }
                }
            }
        );
        super.addLocalization(Locale.Czech, 'graf', 'Zobrazí graf tvé historie LP');

        for (const subCommand of [
            this.meSubCommand,
            this.nameSubCommand,
            this.mentionSubCommand
        ]) {
            subCommand.addOption({
                name: 'queue',
                description: 'Select queue type (Solo/Duo or Flex)',
                localizedName: {
                    [Locale.Czech]: 'fronta'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Výběr typu fronty (Solo/Duo nebo Flex)'
                },
                type: 'STRING',
                required: false,
                choices: [
                    {
                        name: 'Ranked Solo/Duo',
                        value: 'RANKED_SOLO_5x5'
                    },
                    {
                        name: 'Ranked Flex',
                        value: 'RANKED_FLEX_SR'
                    }
                ]
            });
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const queue = interaction.options.getString('queue') || 'RANKED_SOLO_5x5';

        await this.handleAccountCommand(interaction, l, {
            queue
        });
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        DBaccount: Selectable<Account>,
        region: Region,
        customData: CustomData
    ) {
        const lang = getLocale(interaction.locale);

        await interaction.deferReply();

        try {
            // Query LP history from database
            const lpHistory = await conn
                .selectFrom('lp')
                .select(['time', 'LP', 'tier', 'rank'])
                .where('account_id', '=', DBaccount.id)
                .where('queue', '=', customData.queue)
                .orderBy('time', 'asc')
                .execute();

            if (lpHistory.length === 0) {
                await interaction.editReply({
                    content: 'No LP history data available for this queue.'
                });
                return;
            }

            const data: GraphData = {
                puuid: DBaccount.puuid,
                region,
                gameName: DBaccount.gameName,
                tagLine: DBaccount.tagLine,
                profileIconId: 0, // Not needed for graph
                level: 0, // Not needed for graph
                locale: interaction.locale,
                lpHistory: lpHistory.map((lp) => ({
                    time: lp.time,
                    LP: lp.LP,
                    tier: lp.tier as _Tier,
                    rank: lp.rank as _Rank
                })),
                queue: customData.queue
            };

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
