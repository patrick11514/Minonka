import {
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Account } from '$/types/database';
import { Selectable } from 'kysely';
import { conn } from '$/types/connection';
import Logger from '$/lib/logger';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import api from '$/lib/Riot/api';
import { Region } from '$/lib/Riot/types';
import { AccountCommand } from '$/lib/AccountCommand';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { SummonerData } from '$/Worker/tasks/summoner';
import fs from 'node:fs';

const l = new Logger('Summoner', 'green');

export default class Summoner extends AccountCommand {
    constructor() {
        super('summoner', 'Show information about your account');
        super.addLocalization(Locale.Czech, 'summoner', 'Zobrazí informace o tvém účtu');
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const lang = getLocale(interaction.locale);

        let accounts: Selectable<Account>[];

        if (this.meSubCommand.match(interaction)) {
            try {
                accounts = await conn
                    .selectFrom('account')
                    .selectAll()
                    .where('discord_id', '=', interaction.user.id)
                    .execute();

                if (accounts.length == 0) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: lang.summoner.me.notFound
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
        } else if (this.nameSubCommand.match(interaction)) {
            const region = interaction.options.getString('region', true) as Region;
            const gameName = interaction.options.getString('name', true);
            const tagLine = interaction.options.getString('tag', true);

            const account = await api[region].account.name(gameName, tagLine);
            if (!account.status) {
                if (account.code === 404) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: replacePlaceholders(
                            lang.summoner.name.notFound,
                            gameName,
                            tagLine,
                            lang.regions[region]
                        )
                    });
                } else {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: lang.riotApi.error
                    });
                }
                return;
            }

            const summoner = await api[region].summoner.byPuuid(account.data.puuid);
            if (!summoner.status) {
                if (summoner.code === 404) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: replacePlaceholders(
                            lang.summoner.name.notFound,
                            gameName,
                            tagLine,
                            lang.regions[region]
                        )
                    });
                } else {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: lang.riotApi.error
                    });
                }
                return;
            }

            accounts = [
                {
                    id: 0,
                    discord_id: interaction.user.id,
                    puuid: account.data.puuid,
                    account_id: summoner.data.accountId,
                    summoner_id: summoner.data.id,
                    region: region,
                    gameName: account.data.gameName,
                    tagLine: account.data.tagLine
                }
            ];
        } else {
            const mention = interaction.options.getUser('user', true);
            try {
                accounts = await conn
                    .selectFrom('account')
                    .selectAll()
                    .where('discord_id', '=', mention.id)
                    .execute();

                if (accounts.length == 0) {
                    await interaction.reply({
                        flags: MessageFlags.Ephemeral,
                        content: replacePlaceholders(
                            lang.summoner.mention.notFound,
                            mention.toString()
                        )
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
        }

        if (accounts.length > 1) {
            await this.sendAccountSelect(interaction, accounts, lang);
            return;
        }

        this.onMenuSelect(
            interaction,
            accounts[0].summoner_id,
            accounts[0].region as Region
        );
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        summonerId: string,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);

        const summoner = await api[region].summoner.bySummonerId(summonerId);
        if (!summoner.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, summoner)
            });
            return;
        }

        const challenges = await api[region].challenges.byPuuid(summoner.data.puuid);
        if (!challenges.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, challenges)
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
            summonerId: summoner.data.id,
            region: region,
            level: summoner.data.summonerLevel,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            titleId: challenges.data.preferences.title,
            banner: challenges.data.preferences.bannerAccent ?? 1,
            crest: challenges.data.preferences.crestBorder ?? 1,
            prestigeCrest: challenges.data.preferences.prestigeCrestBorderLevel ?? 1,
            challenges: challenges.data.preferences.challengeIds ?? [],
            userChallenges: challenges.data.challenges,
            locale: interaction.locale
        } satisfies SummonerData;

        try {
            const result = await process.workerServer.addJobWait('summoner', data);

            await interaction.reply({
                files: [result]
            });

            fs.unlinkSync(result);
        } catch (e) {
            if (e instanceof Error) {
                l.error(e);
                await interaction.reply({
                    flags: MessageFlags.Ephemeral,
                    content: replacePlaceholders(lang.workerError, e.message)
                });
                return;
            }

            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: lang.genericError
            });
            return;
        }
    }
}
