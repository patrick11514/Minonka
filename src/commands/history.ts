import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import crypto from 'node:crypto';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse, toValidResponse } from '$/lib/Riot/baseRequest';
import { CherryMatchSchema, RegularMatchSchema } from '$/lib/Riot/schemes';
import { queues, Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { DePromise, OmitUnion } from '$/types/types';
import {
    RepliableInteraction,
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    Interaction,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Message
} from 'discord.js';
import { Selectable } from 'kysely';
import { z } from 'zod';

const l = new Logger('History', 'white');

type ButtonData = {
    discordId: string;
    summonerId: string;
    region: Region;
    queue: string | null;
    count: number;
    offset: number;
};

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

        return matchesData.map((match) => {
            const _match = match as toValidResponse<typeof match>;
            let jobId: string;
            if (_match.data.info.gameMode === 'CHERRY') {
                jobId = process.workerServer.addJob('cherryMatch', {
                    ...(_match.data as z.infer<typeof CherryMatchSchema>),
                    locale,
                    region,
                    mySummonerId: summonerId
                });
            } else {
                jobId = process.workerServer.addJob('match', {
                    ...(_match.data as z.infer<typeof RegularMatchSchema>),
                    locale,
                    region,
                    mySummonerId: summonerId
                });
            }

            return jobId;
        });
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
        editMessage: Message<boolean> | ChatInputCommandInteraction,
        interaction: RepliableInteraction<CacheType>,
        jobIds: OmitUnion<DePromise<ReturnType<typeof this.getFiles>>, string>,
        row: ActionRowBuilder<ButtonBuilder>,
        lang: ReturnType<typeof getLocale>
    ) {
        await interaction.deferReply();

        let dontUpdate = false;

        try {
            let progress = 0;
            const max = jobIds.length;

            const files = await Promise.all(
                jobIds.map(async (jobId) => {
                    const start = Date.now();
                    const path = await process.workerServer.wait(jobId);
                    if (!dontUpdate && Date.now() - start > 100)
                        await interaction.editReply({
                            content: replacePlaceholders(
                                lang.match.loading,
                                (++progress).toString(),
                                max.toString()
                            )
                        });
                    return path;
                })
            );

            await interaction.editReply({
                content: lang.match.uploading
            });

            if (editMessage instanceof Message) {
                await editMessage.edit({
                    content: '',
                    files,
                    components: [row]
                });
                await interaction.deleteReply();
            } else {
                await editMessage.editReply({
                    content: '',
                    files,
                    components: [row]
                });
            }
        } catch (e) {
            dontUpdate = true;
            //cancel all jobs
            jobIds.forEach((jobId) => process.workerServer.removeJob(jobId));

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

        const key = crypto.randomBytes(16).toString('hex');

        const inMemory = process.inMemory.getInstance<ButtonData>();
        inMemory.set(key, {
            discordId: interaction.user.id,
            summonerId: account.summoner_id,
            region,
            queue: queue || '',
            count,
            offset
        });

        const row = this.generateButtonRow(lang, key, count, offset, result.length);

        await this.handleMessages(interaction, interaction, result, row, lang);
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

        let { offset } = data;
        const { count, summonerId, region, queue } = data;

        const command = id[2];
        const originalOffset = offset;

        switch (command) {
            case 'prev':
                offset -= count;
                break;
            case 'next':
                offset += count;
                break;
        }

        //clamp offset to 0
        offset = Math.max(0, offset);

        const account = await api[region].summoner.bySummonerId(summonerId);
        if (!account.status) return;

        const result = await this.getFiles(
            interaction.locale,
            region,
            summonerId,
            account.data.puuid,
            queue,
            count,
            offset
        );
        if (typeof result === 'string') {
            if (result === lang.match.empty) {
                //update buttons, so the next button is disabled
                const row = this.generateButtonRow(lang, key, count, originalOffset, 0);

                await interaction.message.edit({
                    components: [row]
                });
            }

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: result
            });
            return;
        }

        const row = this.generateButtonRow(lang, key, count, offset, result.length);

        await this.handleMessages(interaction.message, interaction, result, row, lang);
    }
}
