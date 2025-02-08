import { Command } from '$/lib/Command';
import api from '$/lib/Riot/api';
import { ChatInputCommandInteraction, Locale } from 'discord.js';

export default class Link extends Command {
    constructor() {
        super('link', 'Link your Riot Account');
        this.addLocalization(Locale.Czech, 'propojit', 'Propojí tvůj Riot Účet');
        this.addOption({
            type: 'STRING',
            name: 'name',
            localizedName: {
                [Locale.Czech]: 'jméno'
            },
            description: 'Riot Name before #',
            localizedDescription: {
                [Locale.Czech]: 'Jméno před #'
            },
            required: true
        });
        this.addOption({
            type: 'STRING',
            name: 'tag',
            localizedName: {
                [Locale.Czech]: 'tag'
            },
            description: 'Riot Tag after #',
            localizedDescription: {
                [Locale.Czech]: 'Tag za #'
            },
            required: true
        });
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const name = interaction.options.getString('name', true);
        const tag = interaction.options.getString('tag', true);

        const response = await api.EUN1.account.name(name, tag);

        console.log(response);

        await interaction.reply('Done');
    }
}
