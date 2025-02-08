import { Command } from '$/lib/Command';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { Region, regions } from '$/lib/Riot/types';
import { conn } from '$/types/connection';
import { ChatInputCommandInteraction, Locale, MessageFlags } from 'discord.js';

const l = new Logger('Link', 'white');

export default class Link extends Command {
    constructor() {
        super('link', 'Link your Riot Account');
        this.addLocalization(Locale.Czech, 'propojit', 'Propojí tvůj Riot Účet');
        this.addOption({
            type: 'STRING',
            name: 'name',
            localizedName: {
                [Locale.Czech]: 'jméno'
            },
            description: 'Riot Name before #',
            localizedDescription: {
                [Locale.Czech]: 'Jméno před #'
            },
            required: true
        });
        this.addOption({
            type: 'STRING',
            name: 'tag',
            localizedName: {
                [Locale.Czech]: 'tag'
            },
            description: 'Riot Tag after #',
            localizedDescription: {
                [Locale.Czech]: 'Tag za #'
            },
            required: true
        });
        this.addOption({
            type: 'STRING',
            name: 'region',
            localizedName: {
                [Locale.Czech]: 'region'
            },
            description: 'Your lol region',
            localizedDescription: {
                [Locale.Czech]: 'Tvůj lol region'
            },
            required: true,
            choices: regions.map((region) => {
                return {
                    value: region,
                    name: getLocale(Locale.EnglishUS).regions[region],
                    name_localizations: {
                        [Locale.Czech]: getLocale(Locale.Czech).regions[region]
                    }
                };
            })
        });
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
                    content: replacePlaceholders(lang.riotApi.error, userInfo.code.toString(), userInfo.message)
                });
            }
            return;
        }
        try {
            const exists = await conn.selectFrom('account').select(['id']).where('puuid', '=', userInfo.data.puuid).executeTakeFirst();
            if (exists) {
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: lang.lang.alreadyConnected
                });
                return;
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
                    content: replacePlaceholders(lang.riotApi.error, summoner.code.toString(), summoner.message)
                });
            }
            return;
        }

        try {
            await conn
                .insertInto('account')
                .values({
                    discord_id: interaction.user.id,
                    puuid: userInfo.data.puuid,
                    account_id: summoner.data.accountId,
                    summoner_id: summoner.data.id,
                    gameName: userInfo.data.gameName,
                    tagLine: userInfo.data.tagLine,
                    region: region
                })
                .execute();

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: replacePlaceholders(lang.lang.success, userInfo.data.gameName, userInfo.data.tagLine, summoner.data.summonerLevel.toString())
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
