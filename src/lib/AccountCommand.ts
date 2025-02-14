import {
    ActionRowBuilder,
    CacheType,
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
import { getLocale } from './langs';

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
                    .setValue(account.summoner_id + '@@' + account.region)
                    .setLabel(
                        `${account.gameName}#${account.tagLine} (${lang.regions[account.region as Region]})`
                    );

                return builder;
            })
        );
        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            content: lang.summoner.choice,
            components: [row]
        });
    }

    async menuHandle(interaction: Interaction<CacheType>) {
        if (!interaction.isStringSelectMenu()) return;

        const [summonerId, region] = interaction.values[0].split('@@');

        this.onMenuSelect(interaction, summonerId, region as Region);
    }

    abstract onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        summonerId: string,
        region: Region
    ): Promise<void>;
}
