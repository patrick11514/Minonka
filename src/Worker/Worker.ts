/**
 * Main entry point for Worker
 * @author Patrik Mintěl
 * @license MIT
 */

import { registerCrons } from '$/lib/cron';
import { DiscordBot } from '$/lib/DiscordBot';
import Logger from '$/lib/logger';
import { env } from '$/types/env';
import Path from 'node:path';
import { WebSocket } from 'ws';
import '../lib/pollyfill';
import { setWorkerWebSocket } from './utilities';

const InstanceId = process.env.INSTANCE_ID || '';
const isRemoteWorker = process.env.WORKER_MODE === 'remote';

if (InstanceId) {
    Logger.loggingDirectory = 'logs/worker' + InstanceId;
}

const l = new Logger('Worker' + InstanceId, 'yellow');
l.start('Connecting to server');

// Register crons for remote workers (only version updates)
if (isRemoteWorker) {
    registerCrons(['version']);
}

const resolveModule = (path: string) => {
    let module = import.meta.resolve(path);
    if (process.env.NODE_ENV === 'production' && !module.endsWith('.js')) {
        module += '.js';
    }
    return module;
};

process.discordBot = {
    handleError: () => {}
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as DiscordBot;

// Initialize updating state
process.isUpdating = false;

const setupWebSocket = () => {
    const websocket = new WebSocket(`${env.WEBSOCKET_HOST}:${env.WEBSOCKET_PORT}`);

    websocket.on('error', (err) => {
        l.error(err);
    });

    websocket.on('open', () => {
        l.stop('Connected to server');
        // Set the websocket reference for utilities
        setWorkerWebSocket(websocket);
    });

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsCache = new Map<string, (data: any) => any>();

    const sendJobBack = (jobId: string, data: string | Error, startDate: string) => {
        if (data instanceof Error) {
            websocket.send(`error;${jobId};${data.message};${data.stack};${startDate}`);
            return;
        }
        websocket.send(`completed;${jobId};${JSON.stringify(data)};${startDate}`);
    };

    websocket.on('message', async (message) => {
        const messageStr = message.toString();

        // Handle persistent file check responses
        if (messageStr.startsWith('persistentResult')) {
            // This is handled by the utilities persistantExists function
            return;
        }

        const [job, jobId, startDate, strData] = messageStr.split(';');

        l.start('Got job ' + job + ' with id ' + jobId);

        try {
            // Check if assets are being updated
            if (process.isUpdating) {
                throw new Error(
                    'Assets are currently being updated due to new version of League of Legends, please execute this command later again.'
                );
            }

            const data = JSON.parse(strData);

            if (!jobsCache.has(job)) {
                const imported = await import(
                    resolveModule(Path.join(import.meta.dirname, 'tasks', job))
                );

                jobsCache.set(job, imported.default);
            }

            const jobFunction = jobsCache.get(job);
            if (!jobFunction) {
                throw new Error('Failed to load job');
            }

            const result = await jobFunction(data);
            sendJobBack(jobId, result, startDate);
            l.stop('Job ' + job + ' with id ' + jobId + ' completed');
        } catch (e) {
            sendJobBack(jobId, e as Error, startDate);
            l.stopError('Job ' + job + ' with id ' + jobId + ' failed');
            if (process.env.NODE_ENV === 'development') {
                //eslint-disable-next-line no-console
                console.error(e);
            }
        }
    });

    websocket.on('close', () => {
        l.error('Connection closed, reconnecting in 5 seconds');
        //rejoin after 5 seconds
        setTimeout(setupWebSocket, 5 * 1000);
    });
};

setupWebSocket();
