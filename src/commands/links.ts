import { Command } from '$/lib/Command';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import { Region } from '$/lib/Riot/types';
import { conn } from '$/types/connection';
import { ActionRowBuilder, CacheType, ChatInputCommandInteraction, Interaction, Locale, MessageFlags, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

const l = new Logger('Links', 'red');

export default class Links extends Command {
    constructor() {
        super('links', 'Get all your linked accounts');

        super.addLocalization(Locale.Czech, 'propojení', 'Zobrazí všechny tvoje propojené účty');
        super.on('interactionCreate', this.menuHandle);
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const lang = getLocale(interaction.locale);

        const accounts = await conn.selectFrom('account').selectAll().where('discord_id', '=', interaction.user.id).execute();

        if (accounts.length == 0) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.langs.notFound
            });

            return;
        }

        const accountList = accounts
            .map((account) => {
                return `- ${account.gameName}#${account.tagLine} (${lang.regions[account.region as Region]})`;
            })
            .join('\n');

        const select = new StringSelectMenuBuilder()
            .setCustomId('unlink')
            .setPlaceholder(lang.langs.unlink.placeholder)
            .addOptions(
                accounts.map((account) => {
                    return new StringSelectMenuOptionBuilder()
                        .setValue(account.id.toString())
                        .setLabel(`${account.gameName}#${account.tagLine} (${lang.regions[account.region as Region]})`);
                })
            );
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: replacePlaceholders(lang.langs.accounts, accountList),
            components: [row]
        });
    }

    async menuHandle(interaction: Interaction<CacheType>) {
        if (!interaction.isStringSelectMenu()) return;
        if (interaction.customId !== 'unlink') return;

        const lang = getLocale(interaction.locale);
        const accountId = parseInt(interaction.values[0]);

        if (!accountId) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });

            return;
        }

        const account = await conn
            .selectFrom('account')
            .selectAll()
            .where((eb) => eb.and([eb('id', '=', accountId), eb('discord_id', '=', interaction.user.id)]))
            .executeTakeFirst();

        if (!account) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.langs.unlink.notFound
            });

            return;
        }

        try {
            await conn.deleteFrom('account').where('id', '=', accountId).execute();

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: replacePlaceholders(lang.langs.unlink.success, account.gameName, account.tagLine)
            });
        } catch (e) {
            l.error(e);
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
        }
    }
}
