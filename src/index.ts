/**
 * Main entry point for the bot
 * @author Patrik Mintěl
 * @license MIT
 */

import { exit } from 'process';
import { DiscordBot } from './lib/DiscordBot';
import Logger from './lib/logger';
import { WorkerServer } from './lib/WorkerServer';
import { registerCrons } from './lib/cron';

if (process.argv.includes('--register')) {
    const l = new Logger('CommandRegister', 'cyan');
    const discordBot = new DiscordBot();
    discordBot.on('commandsLoaded', async () => {
        l.start('Registering commands...');
        const registered = await discordBot.registerCommands();
        if (!registered) {
            l.stopError('Failed to register commands');
            return;
        }
        l.stop(
            `Registered commands (${registered.length}): ${registered.map((c) => c.name).join(', ')}`
        );
        exit(0);
    });
} else {
    const l = new Logger('DiscordBot', 'yellow');
    const workerServer = new WorkerServer();
    process.workerServer = workerServer;
    registerCrons();

    l.start('Starting Discord Bot...');

    const discordBot = new DiscordBot();

    discordBot.on('login', (client) => {
        l.stop('Connected to discord as ' + client.user.tag);
    });
}
