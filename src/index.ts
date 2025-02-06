import { DiscordBot } from './lib/DiscordBot';
import Logger from './lib/logger';

console.log(process.argv);

if (process.argv.includes('--register')) {
}

const logger = new Logger('DiscordBot', 'yellow');
logger.start('Starting Discord Bot...');

const discordBot = new DiscordBot();

discordBot.on('login', (client) => {
    logger.stop('Connected to discord as ' + client.user.tag);
});
