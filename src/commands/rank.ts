import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { Account } from '$/types/database';
import { RankData } from '$/Worker/tasks/rank';
import {
    CacheType,
    ChatInputCommandInteraction,
    Interaction,
    Locale,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Rank', 'yellow');

export default class Rank extends AccountCommand {
    constructor() {
        super('rank', 'Get your ranked info', {
            me: {
                description: 'Get your ranked info',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o tvém ranku'
                }
            },
            name: {
                description: 'Get ranked info about another player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o ranku jiného hráče'
                }
            },
            mention: {
                description: 'Get ranked info about mentioned player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí informace o ranku zmíněného hráče'
                }
            }
        });
        super.addLocalization(Locale.Czech, 'rank', 'Zobrazí informace o tvém ranku');

        super.on('interactionCreate', this.clashTeamButton.bind(this));
    }

    async handler(interaction: ChatInputCommandInteraction) {
        await this.handleAccountCommand(interaction, l);
    }

    async clashTeamButton(interaction: Interaction) {
        if (!interaction.isButton()) return;

        const id = interaction.customId.split(';');
        if (id[0] !== 'clrank') return;

        this.onMenuSelect(
            interaction as RepliableInteraction<CacheType>,
            {
                puuid: id[1],
                region: id[2]
            } as Selectable<Account>,
            id[2] as Region
        );
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        DBaccount: Selectable<Account>,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);

        const league = await api[region].league.byPuuid(DBaccount.puuid);
        if (!league.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, league)
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

        const data = {
            puuid: DBaccount.puuid,
            region,
            gameName: account.data.gameName,
            tagLine: account.data.tagLine,
            profileIconId: summoner.data.profileIconId,
            level: summoner.data.summonerLevel,
            ranks: league.data as RankData['ranks'],
            locale: interaction.locale
        } satisfies RankData;

        await interaction.deferReply();

        try {
            const result = await process.workerServer.addJobWait('rank', data);
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
                return;
            }

            await interaction.editReply({
                content: lang.genericError
            });
        }
    }
}
