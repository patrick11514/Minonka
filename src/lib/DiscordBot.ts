import { setStatus } from '$/crons/status';
import { env } from '$/types/env';
import {
    ApplicationCommandOptionType,
    BaseInteraction,
    CacheType,
    Client,
    CommandInteractionOption,
    GatewayIntentBits,
    REST,
    Routes
} from 'discord.js';
import fs from 'node:fs/promises';
import Path from 'node:path';
import { Command } from './Command';
import { EventEmitter } from './EventEmitter';
import Logger from './logger';

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
        this.client.setMaxListeners(0);
        process.client = this.client;

        this.loadCommands();

        this.client.on('ready', (client) => {
            super.emit('login', client);
            setStatus();

            this.commands.forEach((command) => command.onBotLoad(this));
        });

        this.client.login(env.CLIENT_TOKEN);
    }

    private async loadCommands() {
        const l = new Logger('CommandLoader', 'cyan');
        l.start('Loading commands...');
        const path = Path.join(import.meta.dirname, '..', 'commands');
        const files = (await fs.readdir(path))
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
                    l.error(
                        `Class ${c.constructor.name} is not an instance of Command, skipping...`
                    );
                    return false;
                }
                return true;
            });

        //register handlers
        this.client.on('interactionCreate', (interaction) => {
            if (!interaction.isChatInputCommand()) return;

            const command = instances.find(
                (c) => c.slashCommand.name === interaction.commandName
            );
            if (!command) return;

            command.handler(interaction).catch((error) => {
                this.handleError(error, interaction);
            });
        });

        for (const instance of instances) {
            for (const [event, callbacks] of Object.entries(instance.events)) {
                for (const callback of callbacks) {
                    this.client.on(event, (...args) => {
                        //here we assume the first argument is always the interaction
                        //because we are only listening to interactionCreate
                        const interaction = args[0];
                        //but for safety we spread arguments into function, if it will have more than one argument
                        Promise.resolve(callback.bind(instance)(...args)).catch((error) =>
                            this.handleError(error, interaction)
                        );
                    });
                }
            }
        }

        this.commands = instances;
        l.stop(
            `Loaded commands (${instances.length}): ${instances.map((c) => c.constructor.name).join(', ')}`
        );
        super.emit('commandsLoaded');
    }

    async registerCommands() {
        const JSONCommands = this.commands.map((c) => c.slashCommand.toJSON());

        const rest = new REST().setToken(env.CLIENT_TOKEN);

        try {
            return (await rest.put(Routes.applicationCommands(env.CLIENT_ID), {
                body: JSONCommands
            })) as Promise<
                {
                    name: string;
                }[]
            >;
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e);

            process.discordBot.handleError(e, 'RegisterCommands');
            return [];
        }
    }

    getCommand(name: string) {
        return this.commands.find((c) => c.slashCommand.name === name);
    }

    async handleError(error: unknown, interactionOrContext: BaseInteraction | string) {
        // --- Error details ---
        const errName = error instanceof Error ? error.name : 'UnknownError';
        const errMessage =
            error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'No error message';
        const stack =
            error instanceof Error && error.stack
                ? error.stack
                : 'No stack trace available';

        // --- Interaction details ---
        let extendedInfo =
            interactionOrContext instanceof BaseInteraction
                ? 'Unknown interaction'
                : interactionOrContext;

        if (interactionOrContext instanceof BaseInteraction) {
            if (interactionOrContext.isChatInputCommand()) {
                let command = `/${interactionOrContext.commandName}`;

                const stringifyOptions = (
                    option: CommandInteractionOption<CacheType>
                ) => {
                    let value = option.name;
                    if (option.value) {
                        switch (option.type) {
                            case ApplicationCommandOptionType.Boolean:
                            case ApplicationCommandOptionType.Integer:
                            case ApplicationCommandOptionType.Number:
                            case ApplicationCommandOptionType.String:
                                value += `:${option.value}`;
                                break;
                            case ApplicationCommandOptionType.User:
                                value += `:<@${option.value}>`;
                                break;
                            case ApplicationCommandOptionType.Channel:
                                value += `:<#${option.value}>`;
                                break;
                            case ApplicationCommandOptionType.Role:
                                value += `:<@&${option.value}>`;
                                break;
                            case ApplicationCommandOptionType.Mentionable:
                                value += `:<@${option.value}>`;
                                break;
                            default:
                                value += `:N/A`;
                                break;
                        }
                    } else if (option.options && option.options.length > 0) {
                        value +=
                            ' ' +
                            option.options.map((opt) => stringifyOptions(opt)).join(' ');
                    }
                    return value;
                };

                if (interactionOrContext.options.data.length > 0) {
                    command +=
                        ' ' +
                        interactionOrContext.options.data
                            .map((opt) => stringifyOptions(opt))
                            .join(' ');
                }

                extendedInfo = command;
            } else if (interactionOrContext.isStringSelectMenu()) {
                extendedInfo = `SelectMenu (customId: ${interactionOrContext.customId})`;
            } else if (interactionOrContext.isButton()) {
                extendedInfo = `Button (customId: ${interactionOrContext.customId})`;
            } else {
                if ('customId' in interactionOrContext) {
                    extendedInfo = `${interactionOrContext.type} (id: ${interactionOrContext.customId})`;
                } else {
                    extendedInfo = `${interactionOrContext.type} (id: N/A)`;
                }
            }
        }

        // --- Final formatted message ---
        let formatted = `## Hey, some error occurred!
**Time:** ${new Date().toLocaleString()}
**Interaction:** ${extendedInfo}`;
        if (interactionOrContext instanceof BaseInteraction) {
            formatted += `
**Server:** ${interactionOrContext.guild?.name ?? 'DM'} (${interactionOrContext.guildId ?? 'N/A'})
**Executor:** <@${interactionOrContext.user.id}> (${interactionOrContext.user.id})`;
        }
        formatted += `

\`\`\`js
${errName}: ${errMessage}
${stack}
\`\`\``;

        /* eslint-disable no-console */
        // Log original error details to console as a fallback
        console.error('Original error details:');
        console.error(`Name: ${errName}`);
        console.error(`Message: ${errMessage}`);
        console.error(`Stack: ${stack}`);
        try {
            const channel = await this.client.channels.fetch(env.ERRORS_LOG_CHANNEL);
            if (!channel || !channel.isTextBased() || !channel.isSendable()) {
                console.error(
                    "Error log channel is not a text channel or doesn't exist."
                );
                return;
            }
            await channel.send(formatted);
        } catch (e) {
            console.log('Failed to report error to channel:', e);
        }
        /*eslint-enable no-console */
    }
}
