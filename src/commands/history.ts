import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse, toValidResponse } from '$/lib/Riot/baseRequest';
import { queues, Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import {
    RepliableInteraction,
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    Interaction,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { Selectable } from 'kysely';

const l = new Logger('History', 'white');

export default class History extends AccountCommand {
    constructor() {
        super('history', 'Show you match history of last 6 games', {
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
        });
        super.addLocalization(
            Locale.Czech,
            'historie',
            'Zobrazí tvou historii posledních 5 her'
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
                    [Locale.Czech]: 'Vyber fronty pro filtrování'
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
    }

    async getFiles(
        locale: Locale,
        region: Region,
        summonerId: string,
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

        const matches = matchIds.data.map((matchId) => api[region].match.match(matchId));
        const matchesData = await Promise.all(matches);
        if (matchesData.some((match) => !match.status)) {
            return formatErrorResponse(lang, matchesData.find((match) => !match.status)!);
        }

        return matchesData.map(
            (match) => () =>
                process.workerServer.addJobWait('match', {
                    ...(match as toValidResponse<typeof match>).data,
                    locale,
                    region,
                    mySummonerId: summonerId
                })
        );
    }

    generateButtonRow(
        lang: ReturnType<typeof getLocale>,
        userId: string,
        summonerId: string,
        puuid: string,
        region: Region,
        queue: string | null,
        count: number,
        offset: number
    ) {
        //history;discordid;summonerid;puuid;region;queue;count;offset
        const baseId = `history;${userId};${summonerId};${puuid};${region};${queue || ''};${count};${offset}`;
        return new ActionRowBuilder<ButtonBuilder>().addComponents([
            new ButtonBuilder()
                .setCustomId(`${baseId};prev`)
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`${baseId};reload`)
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
                .setCustomId(`${baseId};next`)
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Primary)
        ]);
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        account: Selectable<Account>,
        region: Region
    ) {
        if (!interaction.isChatInputCommand()) return;
        const lang = getLocale(interaction.locale);
        const queue = interaction.options.getString('queue');
        const count = interaction.options.getInteger('count') || 6;
        const offset = interaction.options.getInteger('offset') || 0;

        const result = await this.getFiles(
            interaction.locale,
            region,
            account.summoner_id,
            account.puuid,
            queue,
            count,
            offset
        );

        if (typeof result === 'string') {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: result
            });
            return;
        }

        const row = this.generateButtonRow(
            lang,
            interaction.user.id,
            account.summoner_id,
            account.puuid,
            region,
            queue,
            count,
            offset
        );

        await interaction.deferReply();

        try {
            await interaction.editReply({
                files: await Promise.all(result.map((f) => f())),
                components: [row]
            });
        } catch (e) {
            if (e instanceof Error) {
                l.error(e);
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
        this.handleAccountCommand(interaction, l);
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

        const discordId = id[1];
        if (interaction.user.id !== discordId) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.noPermission
            });
            return;
        }
        const summonerId = id[2];
        const puuid = id[3];
        const region = id[4] as Region;
        const queue = id[5] || null;
        const count = parseInt(id[6]);
        let offset = parseInt(id[7]);
        const command = id[8];

        switch (command) {
            case 'prev':
                offset -= count;
                break;
            case 'next':
                offset += count;
                break;
        }
        const response = await this.getFiles(
            interaction.locale,
            region,
            summonerId,
            puuid,
            queue,
            count,
            offset
        );
        if (typeof response === 'string') {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: response
            });
            return;
        }

        const row = this.generateButtonRow(
            lang,
            discordId,
            summonerId,
            puuid,
            region,
            queue,
            count,
            offset
        );

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        });

        try {
            await interaction.message.edit({
                files: await Promise.all(response.map((f) => f())),
                components: [row]
            });
            await interaction.deleteReply();
        } catch (e) {
            if (e instanceof Error) {
                l.error(e);
                await interaction.editReply({
                    content: replacePlaceholders(
                        getLocale(interaction.locale).workerError,
                        e.message
                    )
                });
                return;
            }

            await interaction.editReply({
                content: getLocale(interaction.locale).genericError
            });
            return;
        }
    }
}
