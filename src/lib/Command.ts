import { SlashCommandBuilder } from 'discord.js';

new SlashCommandBuilder().setNameLocalizations({
    'en-US': 'command',
    cs: 'příkaz'
});

export class Command {
    slashCommand: SlashCommandBuilder;

    constructor(name: string, description: string) {
        this.slashCommand = new SlashCommandBuilder().setName(name).setDescription(description);
    }

    public addOption(name: string, description: string, required: boolean) {
        this.slashCommand.addStringOption((option) => option.setName(name).setDescription(description).setRequired(required));
    }
}
