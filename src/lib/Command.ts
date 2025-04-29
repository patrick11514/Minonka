import {
    ClientEvents,
    Locale,
    SlashCommandBuilder,
    type ChatInputCommandInteraction
} from 'discord.js';
import { constructOption, OptionType } from './types';
import { SubCommand } from './SubCommand';
import { SubCommandGroup } from './SubCommandGroup';
import { DiscordBot } from './DiscordBot';

type HelpMessage = {
    default: string;
    locales: Partial<Record<Locale, string>>;
};

export type HelpParameter = Partial<{
    exampleUsage: HelpMessage;
    extendedHelp: HelpMessage;
}>;

export abstract class Command {
    slashCommand: SlashCommandBuilder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: Record<string, ((...args: any[]) => void)[]> = {};

    constructor(
        name: string,
        description: string,
        public help?: HelpParameter
    ) {
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

    public addSubCommandGroup(subCommandGroup: SubCommandGroup) {
        this.slashCommand.addSubcommandGroup(subCommandGroup.subCommandGroup);
    }

    public on<$Event extends keyof ClientEvents>(
        event: $Event,
        listener: (...args: ClientEvents[$Event]) => void
    ) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(listener);
    }

    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async onBotLoad(client: DiscordBot) {}

    abstract handler(interaction: ChatInputCommandInteraction): Promise<void>;
}
