import { Command } from '$/lib/Command';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { setupRiotOptions } from '$/lib/utilities';
import { conn } from '$/types/connection';
import { ChatInputCommandInteraction, Locale, MessageFlags } from 'discord.js';

const l = new Logger('Link', 'white');

export default class Link extends Command {
    constructor() {
        super('link', 'Link your Riot Account', {
            exampleUsage: {
                default: '/link name:patrick115 tag:Czech region:EUNE',
                locales: {
                    [Locale.Czech]: '/propojit jméno:patrik115 tag:Czech region:EUNE'
                }
            }
        });
        this.addLocalization(Locale.Czech, 'propojit', 'Propojí tvůj Riot Účet');
        setupRiotOptions(this);
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const name = interaction.options.getString('name', true);
        const tag = interaction.options.getString('tag', true);
        const region = interaction.options.getString('region', true) as Region;

        const lang = getLocale(interaction.locale);

        const userInfo = await api[region].account.name(name, tag);

        if (!userInfo.status) {
            if (userInfo.code === 404) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: lang.lang.notFound
                });
            } else {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: formatErrorResponse(lang, userInfo)
                });
            }
            return;
        }

        let exist = false;

        try {
            const exists = await conn
                .selectFrom('account')
                .selectAll()
                .where('puuid', '=', userInfo.data.puuid)
                .executeTakeFirst();
            if (exists) {
                if (exists.discord_id !== null) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: lang.lang.alreadyConnected
                    });
                    return;
                }
                exist = true;
            }
        } catch (e) {
            l.error(e);
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }

        const summoner = await api[region].summoner.byPuuid(userInfo.data.puuid);

        if (!summoner.status) {
            if (summoner.code === 404) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: lang.lang.notFound
                });
            } else {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: formatErrorResponse(lang, summoner)
                });
            }
            return;
        }

        try {
            if (!exist) {
                await conn
                    .insertInto('account')
                    .values({
                        discord_id: interaction.user.id,
                        puuid: userInfo.data.puuid,
                        gameName: userInfo.data.gameName,
                        tagLine: userInfo.data.tagLine,
                        region: region
                    })
                    .execute();
            } else {
                await conn
                    .updateTable('account')
                    .set({
                        discord_id: interaction.user.id,
                        puuid: userInfo.data.puuid,
                        gameName: userInfo.data.gameName,
                        tagLine: userInfo.data.tagLine,
                        region: region
                    })
                    .where('puuid', '=', userInfo.data.puuid)
                    .execute();
            }

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: replacePlaceholders(
                    lang.lang.success,
                    userInfo.data.gameName,
                    userInfo.data.tagLine,
                    summoner.data.summonerLevel.toString()
                )
            });
        } catch (e) {
            l.error(e);
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }
    }
}
