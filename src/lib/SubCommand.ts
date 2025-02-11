import {
    ChatInputCommandInteraction,
    Locale,
    SlashCommandSubcommandBuilder
} from 'discord.js';
import { constructOption, OptionType } from './types';

export class SubCommand {
    subCommand: SlashCommandSubcommandBuilder;

    constructor(name: string, description: string) {
        this.subCommand = new SlashCommandSubcommandBuilder()
            .setName(name)
            .setDescription(description);
    }

    public addLocalization(lang: Locale, name: string, description: string) {
        this.subCommand.setNameLocalization(lang, name);
        this.subCommand.setDescriptionLocalization(lang, description);
    }

    public addOption(option: OptionType) {
        this.subCommand.options.push(constructOption(option));
    }

    public match(interaction: ChatInputCommandInteraction) {
        return interaction.options.getSubcommand() === this.subCommand.name;
    }
}
