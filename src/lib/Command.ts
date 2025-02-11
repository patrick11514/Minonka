import {
    ClientEvents,
    Locale,
    SlashCommandBuilder,
    type ChatInputCommandInteraction
} from 'discord.js';
import { constructOption, OptionType } from './types';
import { SubCommand } from './SubCommand';

export abstract class Command {
    slashCommand: SlashCommandBuilder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: Record<string, (...args: any[]) => void> = {};

    constructor(name: string, description: string) {
        this.slashCommand = new SlashCommandBuilder()
            .setName(name)
            .setDescription(description);
    }

    public addLocalization(lang: Locale, name: string, description: string) {
        this.slashCommand.setNameLocalization(lang, name);
        this.slashCommand.setDescriptionLocalization(lang, description);
    }

    public addOption(option: OptionType) {
        this.slashCommand.options.push(constructOption(option));
    }

    public addSubCommand(subCommand: SubCommand) {
        this.slashCommand.addSubcommand(subCommand.subCommand);
    }

    public on<$Event extends keyof ClientEvents>(
        event: $Event,
        listener: (...args: ClientEvents[$Event]) => void
    ) {
        this.events[event] = listener;
    }

    abstract handler(interaction: ChatInputCommandInteraction): Promise<void>;
}
