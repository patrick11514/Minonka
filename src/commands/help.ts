import { Command, HelpParameter } from '$/lib/Command';
import { DiscordBot } from '$/lib/DiscordBot';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import {
    ActionRowBuilder,
    ApplicationCommand,
    ApplicationCommandOption,
    ApplicationCommandOptionType,
    ApplicationCommandSubCommand,
    ChatInputCommandInteraction,
    Collection,
    Interaction,
    Locale,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from 'discord.js';

export default class Help extends Command {
    private slashCommands!: Collection<string, ApplicationCommand>;
    private discordBot!: DiscordBot;

    constructor() {
        super('help', 'Show help for the bot');

        this.addLocalization(Locale.Czech, 'help', 'Zobrazí nápovědu pro bota');

        super.on('interactionCreate', this.onMenuSelect.bind(this));
    }

    public override async onBotLoad(discordBot: DiscordBot) {
        this.discordBot = discordBot;
        this.slashCommands = await process.client.application!.commands.fetch({
            withLocalizations: true
        });
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const lang = getLocale(interaction.locale);

        const defaultName = <
            $Object extends ApplicationCommand | ApplicationCommandOption
        >(
            obj: $Object
        ) => {
            if (obj.nameLocalizations?.[interaction.locale]) {
                return obj.nameLocalizations?.[interaction.locale];
            }
            return obj.name;
        };

        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('help')
                .setPlaceholder(lang.help.select)
                .addOptions(
                    this.slashCommands
                        .map((command) => [command.name, defaultName(command)])
                        .map(([name, label]) =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel(label!)
                                .setValue(name!)
                        )
                )
        );

        await interaction.reply({
            flags: MessageFlags.Ephemeral,
            components: [row]
        });
    }

    private async onMenuSelect(interaction: Interaction) {
        if (!interaction.isStringSelectMenu()) return;

        const lang = getLocale(interaction.locale);
        const value = interaction.values[0];

        const defaultName = <
            $Object extends ApplicationCommand | ApplicationCommandOption
        >(
            obj: $Object
        ) => {
            if (obj.nameLocalizations?.[interaction.locale]) {
                return obj.nameLocalizations?.[interaction.locale];
            }
            return obj.name;
        };

        const defaultDescription = <
            $Object extends ApplicationCommand | ApplicationCommandOption
        >(
            obj: $Object
        ) => {
            if (obj.descriptionLocalizations?.[interaction.locale]) {
                return obj.descriptionLocalizations?.[interaction.locale];
            }
            return obj.description;
        };

        const defaultHelp = <$Object extends HelpParameter[keyof HelpParameter]>(
            obj: $Object
        ) => {
            if (obj?.locales?.[interaction.locale]) {
                return obj?.locales?.[interaction.locale];
            }
            return obj?.default;
        };

        const command = this.slashCommands.find((command) => command.name === value)!;

        const subCommands = command.options.some(
            (option) => option.type === ApplicationCommandOptionType.Subcommand
        );
        const noEmptyOptions = command.options.length > 0;

        let ref = '';
        if (!subCommands) {
            //ref to command
            ref = `(</${command.name}:${command.id}>)`;
        }

        const lines = [
            `# ${replacePlaceholders(lang.help.title, defaultName(command) ?? '')} ${ref}`,
            `**${lang.help.description}:** ${defaultDescription(command)}`
        ];

        const printSubCommand = (
            option: ApplicationCommandSubCommand,
            depth = 1,
            parent = ''
        ) => {
            lines.push(
                `${'  '.repeat(depth - 1)}- **${defaultName(option)}** (</${command.name} ${parent}${option.name}:${command.id}>): ${defaultDescription(option)}`
            );
            for (const subOption of option.options ?? []) {
                lines.push(
                    `${'  '.repeat(depth)}- **${defaultName(subOption)}**${subOption.required === false ? '?' : ''}: ${defaultDescription(subOption)}`
                );
            }
        };

        if (!subCommands && noEmptyOptions) {
            //print options
            lines.push(`## ${lang.help.parameters}`);
            for (const option of command.options.filter(
                (o) => o.type !== ApplicationCommandOptionType.Subcommand
            )) {
                lines.push(`- **${defaultName(option)}**: ${defaultDescription(option)}`);
            }
        } else if (subCommands) {
            //print subcommands
            lines.push(`## ${lang.help.subcommands}`);
            command.options
                .filter((o) => o.type === ApplicationCommandOptionType.Subcommand)
                .forEach((o) => printSubCommand(o));

            //and command groups, if any
            for (const option of command.options.filter(
                (o) => o.type === ApplicationCommandOptionType.SubcommandGroup
            )) {
                lines.push(`- **${defaultName(option)}**: ${defaultDescription(option)}`);

                if (option.options) {
                    option.options
                        .filter((o) => o.type === ApplicationCommandOptionType.Subcommand)
                        .forEach((o) => printSubCommand(o, 2, `${defaultName(option)} `));
                }
            }
        }

        const commandClass = this.discordBot.getCommand(command.name);
        if (commandClass) {
            if (commandClass.help?.exampleUsage) {
                lines.push(`## ${lang.help.exampleUsage}`);
                lines.push(defaultHelp(commandClass.help.exampleUsage)!);
            }

            if (commandClass.help?.extendedHelp) {
                lines.push(`## ${lang.help.extendedDescription}`);
                lines.push(defaultHelp(commandClass.help.extendedHelp)!);
            }
        }

        await interaction.update({
            content: lines.join('\n')
        });
    }
}
