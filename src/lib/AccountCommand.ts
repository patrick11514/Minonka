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
import { Command } from './Command';
import { Region } from './Riot/types';
import { SubCommand } from './SubCommand';
import { setupRiotOptions } from './utilities';
import { getLocale, replacePlaceholders } from './langs';
import { Selectable } from 'kysely';
import { Account } from '$/types/database';
import { conn } from '$/types/connection';
import api from './Riot/api';
import Logger from './logger';

export abstract class AccountCommand extends Command {
    protected meSubCommand: SubCommand;
    protected nameSubCommand: SubCommand;
    protected mentionSubCommand: SubCommand;

    constructor(name: string, description: string) {
        super(name, description);

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

    public async sendAccountSelect(
        interaction: RepliableInteraction,
        accounts: {
            summoner_id: string;
            gameName: string;
            tagLine: string;
            region: string;
        }[],
        lang: ReturnType<typeof getLocale>
    ) {
        const select = new StringSelectMenuBuilder().setCustomId('summoner').addOptions(
            accounts.map((account) => {
                const builder = new StringSelectMenuOptionBuilder()
                    .setValue(
                        this.slashCommand.name +
                            '@@' +
                            account.summoner_id +
                            '@@' +
                            account.region
                    )
                    .setLabel(
                        `${account.gameName}#${account.tagLine} (${lang.regions[account.region as Region]})`
                    );

                return builder;
            })
        );
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: lang.account.choice,
            components: [row]
        });
    }

    async handleAccountCommand(interaction: ChatInputCommandInteraction, l: Logger) {
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
                        content: lang.account.me.notFound
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
                            lang.account.name.notFound,
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
                            lang.account.name.notFound,
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
                            lang.account.mention.notFound,
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

    async menuHandle(interaction: Interaction<CacheType>) {
        if (!interaction.isStringSelectMenu()) return;

        const [commandSource, summonerId, region] = interaction.values[0].split('@@');
        if (commandSource !== this.slashCommand.name) return;

        this.onMenuSelect(interaction, summonerId, region as Region);
    }

    abstract onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        summonerId: string,
        region: Region
    ): Promise<void>;
}
