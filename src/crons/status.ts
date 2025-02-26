import { Cron } from '$/lib/cron';
import { ActivityType } from 'discord.js';

const statuses = [
    '/ggez.exe started',
    'Beep boop, stealing baron',
    '404: skill not found',
    "I' just only bot, but still better, than your support",
    'Patch %lolPatch%'
];

export const setStatus = () => {
    process.client.user?.setActivity({
        type: ActivityType.Custom,
        name: statuses[Math.floor(Math.random() * statuses.length)].replace(
            '%lolPatch%',
            process.lolPatch
        )
    });
};

export default ['0 */5 * * * *', setStatus] satisfies Cron;
