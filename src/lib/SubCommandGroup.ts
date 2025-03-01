import {
    ChatInputCommandInteraction,
    Locale,
    SlashCommandSubcommandGroupBuilder
} from 'discord.js';
import { SubCommand } from './SubCommand';

export class SubCommandGroup {
    subCommandGroup: SlashCommandSubcommandGroupBuilder;

    constructor(name: string, description: string) {
        this.subCommandGroup = new SlashCommandSubcommandGroupBuilder()
            .setName(name)
            .setDescription(description);
    }

    public addLocalization(locale: Locale, name: string, description: string) {
        this.subCommandGroup.setNameLocalization(locale, name);
        this.subCommandGroup.setDescriptionLocalization(locale, description);
    }

    public addSubCommand(subCommand: SubCommand) {
        this.subCommandGroup.addSubcommand(subCommand.subCommand);
    }

    public match(interaction: ChatInputCommandInteraction) {
        return interaction.options.getSubcommandGroup() === this.subCommandGroup.name;
    }
}
