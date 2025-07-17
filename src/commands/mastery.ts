import { AccountCommand } from '$/lib/AccountCommand';
import { getRiotLanguageFromDiscordLocale } from '$/lib/Assets';
import { getLocale } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { MasterySchema } from '$/lib/Riot/schemes';
import { Region } from '$/lib/Riot/types';
import { discordLocaleToJSLocale, getChampionsMap } from '$/lib/utilities';
import { Account } from '$/types/database';
import {
    RepliableInteraction,
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    Interaction,
    APISelectMenuOption,
    MessageFlags
} from 'discord.js';
import { Selectable } from 'kysely';
import crypto from 'node:crypto';
import { z } from 'zod';

const l = new Logger('Mastery', 'green');

type InMemory = {
    discordId: string;
    puuid: string;
    region: Region;
    offset: number;
};

export default class Mastery extends AccountCommand {
    constructor() {
        super('mastery', 'Get your master info', {
            me: {
                description: 'Get your master info',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí tvoje masteries na postavách'
                }
            },
            name: {
                description: 'Get master info about another player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí masteries postav jiného hráče'
                }
            },
            mention: {
                description: 'Get master info about mentioned player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí masteries postav zmíněného hráče'
                }
            }
        });

        super.on('interactionCreate', this.onSelectMenu.bind(this));
    }

    async handler(interaction: ChatInputCommandInteraction) {
        await this.handleAccountCommand(interaction, l);
    }

    private async generateComponents(
        locale: Locale,
        key: string,
        masteries: z.infer<typeof MasterySchema>[],
        offset = 0
    ) {
        const lang = getLocale(locale);
        const LIMIT = 25;

        const champions = await getChampionsMap(getRiotLanguageFromDiscordLocale(locale));
        if (!champions) return;

        const row = new ActionRowBuilder<StringSelectMenuBuilder>();
        const select = new StringSelectMenuBuilder()
            .setCustomId(`mastery:${key}`)
            .setPlaceholder(lang.mastery.select)
            .setMinValues(1)
            .setMaxValues(1);

        //On Page 1, only last entry will be "Next Page"
        //On Other Pages, first entry will be also "Previous Page"
        const cutDown = offset === 0 ? 1 : 2;
        const filteredMasteries = masteries.slice(offset, offset + LIMIT - cutDown);

        const options = await filteredMasteries.asyncMap(async (mastery) => {
            const champion = champions.get(mastery.championId);
            const emoji = await process.emoji.getEmoji('champion', champion?.name ?? '');
            if (!emoji) return null;

            return {
                label: `${champion?.name} - ${lang.mastery.level} ${mastery.championLevel} - ${mastery.championPoints} ${lang.mastery.points}`,
                emoji: {
                    id: emoji.id
                },
                value: mastery.championId.toString()
            } satisfies APISelectMenuOption;
        });

        if (cutDown === 2) {
            //add prev button
            select.addOptions([
                {
                    label: lang.mastery.prev,
                    emoji: '⬅️',
                    value: 'prev'
                }
            ]);
        }

        select.addOptions(
            options.filter((option) => option !== null) as APISelectMenuOption[]
        );

        if (options.length === LIMIT - cutDown) {
            //add next button
            select.addOptions([
                {
                    label: lang.mastery.next,
                    emoji: '➡️',
                    value: 'next'
                }
            ]);
        }

        row.addComponents(select);
        return row;
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        user: Selectable<Account>,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);
        const masteries = await api[region].mastery.byPuuid(user.puuid);

        if (!masteries.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, masteries)
            });
            return;
        }

        const key = crypto.randomBytes(16).toString('hex');
        const memory = process.inMemory.getInstance<InMemory>();
        memory.set(key, {
            discordId: interaction.user.id,
            puuid: user.puuid,
            region: region,
            offset: 0
        });

        const row = await this.generateComponents(
            interaction.locale,
            key,
            masteries.data,
            0
        );

        if (!row) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }

        await interaction.reply({
            components: [row]
        });
    }

    private async onSelectMenu(interaction: Interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const id = interaction.customId.split(':');
        if (id[0] !== 'mastery') return;

        const lang = getLocale(interaction.locale);
        const memory = process.inMemory.getInstance<InMemory>();
        const key = id[1];
        const data = await memory.get(key);
        if (!data) return;

        if (data.discordId !== interaction.user.id) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.noPermission
            });
            return;
        }

        //now see what was selected
        const selected = interaction.values[0];

        if (selected === 'prev') {
            //go back
            data.offset -= data.offset === 24 ? 24 : 23;
        } else if (selected === 'next') {
            //got forward
            data.offset += data.offset === 0 ? 24 : 23;
        }

        //if prev/next generate row
        if (['prev', 'next'].includes(selected)) {
            const masteries = await api[data.region].mastery.byPuuid(data.puuid);

            if (!masteries.status) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: formatErrorResponse(lang, masteries)
                });
                return;
            }

            const row = await this.generateComponents(
                interaction.locale,
                key,
                masteries.data,
                data.offset
            );

            if (!row) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: lang.genericError
                });
                return;
            }

            await interaction.message.edit({
                components: [row]
            });
            await interaction.deferUpdate();

            await memory.set(key, data);
            return;
        }

        const championId = parseInt(selected);

        //print info about mastery
        const championData = await api[data.region].mastery.byChampionId(
            data.puuid,
            championId
        );

        if (!championData.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, championData)
            });
            return;
        }

        const champions = await getChampionsMap(
            getRiotLanguageFromDiscordLocale(interaction.locale)
        );

        if (!champions) return;
        const champion = champions.get(championId)!;
        const championEmoji = await process.emoji.getEmoji('champion', champion.name);

        const date = new Date(championData.data.lastPlayTime);

        const lvl = championData.data.championLevel;
        const mastery = await process.emoji.getEmoji(
            'misc',
            `mastery${lvl > 10 ? 10 : lvl}`
        );

        const locale = discordLocaleToJSLocale(interaction.locale);
        const intl = Intl.NumberFormat(locale);

        const message = `## ${championEmoji?.toString()} ${champion.name}
**${lang.mastery.level}**: ${championData.data.championLevel} ${mastery?.toString()}
**${lang.mastery.points}**: ${intl.format(championData.data.championPoints)}
**${lang.mastery.lastPlayed}**: ${date.toLocaleDateString(locale)} ${lang.mastery.atTime} ${date.toLocaleTimeString(locale)}`;

        await interaction.message.edit({
            content: message
        });

        await interaction.deferUpdate();
    }
}
