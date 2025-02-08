import { env } from '$/types/env';
import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
import { EventEmitter } from './EventEmitter';
import fs from 'node:fs';
import Path from 'node:path';
import Logger from './logger';
import { Command } from './Command';

type Events = {
    login: (client: Client<true>) => void;
    commandsLoaded: () => void;
    command: () => void;
};

export class DiscordBot extends EventEmitter<Events> {
    private client: Client;
    private commands: Command[] = [];

    constructor() {
        super();

        this.client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
        });

        this.loadCommands();

        this.client.on('ready', (client) => super.emit('login', client));

        this.client.login(env.CLIENT_TOKEN);
    }

    private async loadCommands() {
        const l = new Logger('CommandLoader', 'cyan');
        l.start('Loading commands...');
        const path = Path.join(import.meta.dirname, '..', 'commands');
        const files = fs
            .readdirSync(path)
            .filter((file) => file.endsWith('.js') || file.endsWith('.ts'))
            .map(async (file) => await import(Path.join(path, file)));
        const result = await Promise.all(files);

        //map to default exports
        const classes = result.map((r) => r.default);

        //create new instances
        const instances: Command[] = classes
            .filter((c) => {
                if (typeof c !== 'function') {
                    l.error(`Class ${c.name} is not a constructor, skipping...`);
                    return false;
                }
                return true;
            })
            .map((c) => new c())
            .filter((c) => {
                if (!(c instanceof Command)) {
                    l.error(`Class ${c.constructor.name} is not an instance of Command, skipping...`);
                    return false;
                }
                return true;
            });

        //register handlers
        this.client.on('interactionCreate', (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = instances.find((c) => c.slashCommand.name === interaction.commandName);
            if (!command) return;

            command.handler(interaction);
        });

        for (const instance of instances) {
            for (const [event, callback] of Object.entries(instance.events)) {
                this.client.on(event, callback.bind(instance));
            }
        }

        this.commands = instances;
        l.stop(`Loaded commands (${instances.length}): ${instances.map((c) => c.constructor.name).join(', ')}`);
        super.emit('commandsLoaded');
    }

    async registerCommands() {
        const JSONCommands = this.commands.map((c) => c.slashCommand.toJSON());

        const rest = new REST().setToken(env.CLIENT_TOKEN);

        try {
            return (await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: JSONCommands })) as Promise<
                {
                    name: string;
                }[]
            >;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);
            return [];
        }
    }
}
