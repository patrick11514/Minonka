import {
    APIApplicationCommandOptionChoice,
    ClientEvents,
    Locale,
    SlashCommandAttachmentOption,
    SlashCommandBooleanOption,
    SlashCommandBuilder,
    SlashCommandChannelOption,
    SlashCommandMentionableOption,
    SlashCommandRoleOption,
    SlashCommandStringOption,
    SlashCommandUserOption,
    type ChatInputCommandInteraction
} from 'discord.js';

export abstract class Command {
    slashCommand: SlashCommandBuilder;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    events: Record<string, (...args: any[]) => void> = {};

    constructor(name: string, description: string) {
        this.slashCommand = new SlashCommandBuilder().setName(name).setDescription(description);
    }

    public addLocalization(lang: Locale, name: string, description: string) {
        this.slashCommand.setNameLocalization(lang, name);
        this.slashCommand.setDescriptionLocalization(lang, description);
    }

    public addOption(
        option: {
            name: string;
            localizedName?: Partial<Record<Locale, string>>;
            description: string;
            localizedDescription?: Partial<Record<Locale, string>>;
            required: boolean;
        } & (
            | {
                  type: 'STRING' | 'INTEGER' | 'NUMBER';
                  min?: number;
                  max?: number;
                  choices?: APIApplicationCommandOptionChoice<string>[];
              }
            | {
                  type: 'BOOLEAN' | 'USER' | 'CHANNEL' | 'ROLE' | 'MENTIONABLE' | 'ATTACHMENT';
              }
        )
    ) {
        let optionBuilder:
            | SlashCommandStringOption
            | SlashCommandBooleanOption
            | SlashCommandUserOption
            | SlashCommandChannelOption
            | SlashCommandRoleOption
            | SlashCommandMentionableOption
            | SlashCommandAttachmentOption;

        if (option.type === 'STRING' || option.type === 'INTEGER' || option.type === 'NUMBER') {
            switch (option.type) {
                case 'STRING':
                    optionBuilder = new SlashCommandStringOption();
                    break;
                case 'INTEGER':
                    optionBuilder = new SlashCommandStringOption();
                    break;
                case 'NUMBER':
                    optionBuilder = new SlashCommandStringOption();
                    break;
            }
            if ('min' in option) {
                optionBuilder.setMinLength(option.min as number);
            }
            if ('max' in option) {
                optionBuilder.setMaxLength(option.max as number);
            }
            if ('choices' in option) {
                optionBuilder.addChoices(option.choices as APIApplicationCommandOptionChoice<string>[]);
            }
        } else {
            switch (option.type) {
                case 'BOOLEAN':
                    optionBuilder = new SlashCommandBooleanOption();
                    break;
                case 'USER':
                    optionBuilder = new SlashCommandUserOption();
                    break;
                case 'CHANNEL':
                    optionBuilder = new SlashCommandChannelOption();
                    break;
                case 'ROLE':
                    optionBuilder = new SlashCommandRoleOption();
                    break;
                case 'MENTIONABLE':
                    optionBuilder = new SlashCommandMentionableOption();
                    break;
                case 'ATTACHMENT':
                    optionBuilder = new SlashCommandAttachmentOption();
                    break;
            }
        }

        optionBuilder.setName(option.name).setDescription(option.description).setRequired(option.required);

        if ('localizedName' in option) {
            optionBuilder.setNameLocalizations(option.localizedName as Record<Locale, string>);
        }

        if ('localizedDescription' in option) {
            optionBuilder.setDescriptionLocalizations(option.localizedDescription as Record<Locale, string>);
        }

        this.slashCommand.options.push(optionBuilder);
    }

    public on<$Event extends keyof ClientEvents>(event: $Event, listener: (...args: ClientEvents[$Event]) => void) {
        this.events[event] = listener;
    }

    abstract handler(interaction: ChatInputCommandInteraction): Promise<void>;
}
