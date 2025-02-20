import {
    APIApplicationCommandOptionChoice,
    Locale,
    SlashCommandAttachmentOption,
    SlashCommandBooleanOption,
    SlashCommandChannelOption,
    SlashCommandIntegerOption,
    SlashCommandMentionableOption,
    SlashCommandNumberOption,
    SlashCommandRoleOption,
    SlashCommandStringOption,
    SlashCommandUserOption
} from 'discord.js';

export type OptionType = {
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
            choices?: APIApplicationCommandOptionChoice<string | number>[];
            autocomplete?: boolean;
        }
        | {
            type: 'BOOLEAN' | 'USER' | 'CHANNEL' | 'ROLE' | 'MENTIONABLE' | 'ATTACHMENT';
        }
    );

export const constructOption = (option: OptionType) => {
    let optionBuilder:
        | SlashCommandStringOption
        | SlashCommandBooleanOption
        | SlashCommandUserOption
        | SlashCommandChannelOption
        | SlashCommandRoleOption
        | SlashCommandMentionableOption
        | SlashCommandAttachmentOption
        | SlashCommandIntegerOption
        | SlashCommandNumberOption;

    if (
        option.type === 'STRING' ||
        option.type === 'INTEGER' ||
        option.type === 'NUMBER'
    ) {
        switch (option.type) {
            case 'STRING':
                optionBuilder = new SlashCommandStringOption();

                break;
            case 'INTEGER':
                optionBuilder = new SlashCommandIntegerOption();
                break;
            case 'NUMBER':
                optionBuilder = new SlashCommandNumberOption();
                break;
        }

        if ('min' in option) {
            if (optionBuilder instanceof SlashCommandStringOption) {
                optionBuilder.setMinLength(option.min as number);
            } else if (
                optionBuilder instanceof SlashCommandIntegerOption ||
                optionBuilder instanceof SlashCommandNumberOption
            ) {
                optionBuilder.setMinValue(option.min as number);
            }
        }
        if ('max' in option) {
            if (optionBuilder instanceof SlashCommandIntegerOption) {
                optionBuilder.setMaxValue(option.max as number);
            } else if (optionBuilder instanceof SlashCommandNumberOption) {
                optionBuilder.setMaxValue(option.max as number);
            }
        }
        if ('choices' in option) {
            //inner assert will handle if user provide bad type eg. number in StringOption
            //eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionBuilder.addChoices(option.choices as any);
        }

        if ('autocomplete' in option) {
            optionBuilder.setAutocomplete(option.autocomplete as boolean);
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

    optionBuilder
        .setName(option.name)
        .setDescription(option.description)
        .setRequired(option.required);

    if ('localizedName' in option) {
        optionBuilder.setNameLocalizations(
            option.localizedName as Record<Locale, string>
        );
    }

    if ('localizedDescription' in option) {
        optionBuilder.setDescriptionLocalizations(
            option.localizedDescription as Record<Locale, string>
        );
    }

    return optionBuilder;
};
