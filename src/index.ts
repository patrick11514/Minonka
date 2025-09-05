/**
 * Main entry point for the bot
 * @author Patrik Mintěl
 * @license MIT
 */

import { exit } from 'process';
import { registerCrons } from './lib/cron';
import { DiscordBot } from './lib/DiscordBot';
import { EmojiManager } from './lib/EmojiManager';
import { InMemory } from './lib/InMemory';
import Logger from './lib/logger';
import './lib/pollyfill';
import { WorkerServer } from './lib/WorkerServer';

//Initialize global process variables
process.patching = false;

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
    process.inMemory = new InMemory();

    const emoji = new EmojiManager();
    process.emoji = emoji;

    registerCrons();

    l.start('Starting Discord Bot...');

    const discordBot = new DiscordBot();
    process.discordBot = discordBot;

    discordBot.on('login', (client) => {
        l.stop('Connected to discord as ' + client.user.tag);

        //Only sync, when its not patching on startup, because
        //after patch it will automatically sync emojis
        if (!process.patching) emoji.sync();
    });
}
