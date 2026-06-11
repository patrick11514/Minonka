import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { GraphTaskInput } from '$/types/worker/GraphTaskInput';
import { conn } from '$/types/connection';
import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    Message,
    MessageFlags,
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
        super('graph', 'Get LP history graph', {
            me: {
                description: 'Get your LP history graph',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí graf tvé historie LP'
                }
            },
            name: {
                description: 'Get LP history graph of another player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí graf historie LP jiného hráče'
                }
            },
            mention: {
                description: 'Get LP history graph of mentioned player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí graf historie LP zmíněného hráče'
                }
            }
        });
        super.addLocalization(Locale.Czech, 'graf', 'Zobrazí graf tvé historie LP');

        for (const subCommand of [
            this.meSubCommand,
            this.nameSubCommand,
            this.mentionSubCommand
        ]) {
            subCommand.addOption({
                name: 'queue',
                description: 'Select queue to show graph for',
                localizedName: {
                    [Locale.Czech]: 'fronta'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Výběr fronty pro zobrazení grafu'
                },
                type: 'STRING',
                required: true,
                choices: [
                    {
                        name: 'Solo/Duo',
                        value: 'RANKED_SOLO_5x5',
                        name_localizations: {
                            [Locale.Czech]: 'Solo/Tandem'
                        }
                    },
                    {
                        name: 'Flex',
                        value: 'RANKED_FLEX_SR',
                        name_localizations: {
                            [Locale.Czech]: 'Flexibilní'
                        }
                    }
                ]
            });
        }
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const queue = interaction.options.getString('queue', true);

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
        const { queue } = customData;

        // Fetch history first
        const history = await conn
            .selectFrom('lp')
            .selectAll()
            .where('account_id', '=', DBaccount.id)
            .where('queue', '=', queue)
            .orderBy('time', 'desc')
            .limit(50)
            .execute();

        if (history.length === 0) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.graph.noRank
            });
            return;
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

        const reversedHistory = history.reverse();
        const localeString = interaction.locale === Locale.Czech ? 'cs' : 'en';
        const formatter = new Intl.DateTimeFormat(
            interaction.locale === Locale.Czech ? 'cs-CZ' : 'en-US',
            {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }
        );

        const historyPayload = reversedHistory.map((item) => ({
            lp: item.LP,
            rank: item.rank,
            tier: item.tier,
            time: item.time ? formatter.format(new Date(item.time)) : null
        }));

        const data = {
            puuid: DBaccount.puuid,
            region,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            level: summoner.data.summonerLevel,
            locale: localeString,
            queue,
            history: historyPayload
        } satisfies GraphTaskInput;

        const header = `<@${interaction.user.id}> ${account.data.gameName}#${account.data.tagLine} (${lang.regions[region] ?? region}):\n`;

        let publicMessage: Message<boolean> | undefined = undefined;
        if (
            interaction.isStringSelectMenu() &&
            interaction.channel?.isTextBased() &&
            interaction.channel.isSendable()
        ) {
            publicMessage = await interaction.channel.send({
                content: header + lang.graph.generatingImage
            });
            await interaction.reply({
                content: lang.graph.sentToChannel,
                flags: MessageFlags.Ephemeral
            });
            await interaction.deleteReply();
        } else {
            await interaction.deferReply();
        }

        try {
            const result = await process.workerServer.addJobWait('graph', data);

            if (publicMessage) {
                await publicMessage.edit({
                    content: header,
                    files: [result]
                });
            } else {
                await interaction.editReply({
                    content: header,
                    files: [result]
                });
            }

            await fs.unlink(result);
        } catch (e) {
            l.log(e);

            if (e instanceof Error) {
                l.error(e);
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
        }
    }
}
