import { Command } from '$/lib/Command';
import {
    ActionRowBuilder,
    CacheType,
    ChatInputCommandInteraction,
    Interaction,
    Locale,
    MessageFlags,
    RepliableInteraction,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';
import { SubCommand } from '$/lib/SubCommand';
import { setupRiotOptions } from '$/lib/utilities';
import { Account } from '$/types/database';
import { Selectable } from 'kysely';
import { conn } from '$/types/connection';
import Logger from '$/lib/logger';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import api from '$/lib/Riot/api';
import { Region } from '$/lib/Riot/types';

const l = new Logger('Summoner', 'green');

export default class Summoner extends Command {
    private meSubCommand: SubCommand;
    private nameSubCommand: SubCommand;
    private mentionSubCommand: SubCommand;

    constructor() {
        super('summoner', 'Show information about your account');
        super.addLocalization(Locale.Czech, 'summoner', 'Zobrazí informace o tvém účtu');

        this.meSubCommand = new SubCommand(
            'me',
            'Show information about your account(s)'
        );
        this.meSubCommand.addLocalization(
            Locale.Czech,
            'já',
            'Zobrazí informace o tvém účtu/tvých účtech'
        );
        super.addSubCommand(this.meSubCommand);

        this.nameSubCommand = new SubCommand(
            'name',
            'Show information about a specific account'
        );
        this.nameSubCommand.addLocalization(
            Locale.Czech,
            'jméno',
            'Zobrazí informace o konkrétním účtu'
        );
        setupRiotOptions(this.nameSubCommand);
        super.addSubCommand(this.nameSubCommand);

        this.mentionSubCommand = new SubCommand(
            'mention',
            'Show information about a mentioned account'
        );
        this.mentionSubCommand.addLocalization(
            Locale.Czech,
            'zmínka',
            'Zobrazí informace o zmíněném účtu'
        );
        this.mentionSubCommand.addOption({
            type: 'USER',
            name: 'user',
            localizedName: {
                [Locale.Czech]: 'uživatel'
            },
            description: 'Mentioned user',
            localizedDescription: {
                [Locale.Czech]: 'Zmíněný uživatel'
            },
            required: true
        });
        super.addSubCommand(this.mentionSubCommand);

        super.on('interactionCreate', this.menuHandle);
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
                    region: region as string,
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
            const select = new StringSelectMenuBuilder()
                .setCustomId('summoner')
                .addOptions(
                    accounts.map((account) => {
                        const builder = new StringSelectMenuOptionBuilder()
                            .setValue(account.summoner_id)
                            .setLabel(
                                `${account.gameName}#${account.tagLine} (${lang.regions[account.region as Region]})`
                            );

                        return builder;
                    })
                );
            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                select
            );

            await interaction.reply({
                content: lang.summoner.choice,
                components: [row]
            });
            return;
        }

        this.handleSummoner(interaction, accounts[0].summoner_id);
    }

    async menuHandle(interaction: Interaction<CacheType>) {
        if (!interaction.isStringSelectMenu()) return;

        this.handleSummoner(interaction, interaction.values[0]);
    }

    private async handleSummoner(
        interaction: RepliableInteraction<CacheType>,
        summonerId: string
    ) {
        interaction.reply({
            content: summonerId
        });
    }
}
