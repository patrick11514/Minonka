import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { SummonerData } from '$/Worker/tasks/summoner';
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

const l = new Logger('Summoner', 'green');

export default class Summoner extends AccountCommand {
    constructor() {
        super('summoner', 'Show information about your account', {
            me: {
                description: 'Show information about your account',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o tvém účtu'
                }
            },
            name: {
                description: 'Show information about another account',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o jiném účtu'
                }
            },
            mention: {
                description: 'Show information about mentioned account',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o zmíněném účtu'
                }
            }
        });
        super.addLocalization(Locale.Czech, 'summoner', 'Zobrazí informace o tvém účtu');
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

        const summoner = await api[region].summoner.byPuuid(DBaccount.puuid);
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
            puuid: summoner.data.puuid,
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

        const header = `<@${interaction.user.id}> ${account.data.gameName}#${account.data.tagLine} (${region}):\n`;

        let publicMessage: Message<boolean> | undefined = undefined;
        if (
            interaction.isStringSelectMenu() &&
            interaction.channel?.isTextBased() &&
            interaction.channel.isSendable()
        ) {
            publicMessage = await interaction.channel.send({
                content: header + `Generating summoner image...`
            });
            await interaction.reply({
                content: 'Sent to channel',
                flags: MessageFlags.Ephemeral
            });
            await interaction.deleteReply();
        } else {
            await interaction.deferReply();
        }

        try {
            const result = await process.workerServer.addJobWait('summoner', data);

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
            return;
        }
    }
}
