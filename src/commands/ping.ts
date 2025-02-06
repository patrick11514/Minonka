import { Command } from '$/lib/Command';
import { ChatInputCommandInteraction } from 'discord.js';

export default class Ping extends Command {
    constructor() {
        super('ping', 'Ping command');

        super.addOption({
            name: 'message',
            description: 'Message to send',
            required: true,
            type: 'STRING'
        });
    }

    handler(interaction: ChatInputCommandInteraction): void {
        interaction.reply({ content: 'Pong!' });
    }
}
