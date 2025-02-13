/**
 * Main entry point for Worker
 * @author Patrik Mintěl
 * @license MIT
 */

import Logger from '$/lib/logger';
import { env } from '$/types/env';
import { WebSocket } from 'ws';
import Path from 'node:path';

const InstanceId = process.env.INSTANCE_ID || '';

if (InstanceId) {
    Logger.loggingDirectory = 'logs/worker' + InstanceId;
}

const l = new Logger('Worker' + InstanceId, 'yellow');
l.start('Connecting to server');

const setupWebSocket = () => {
    const websocket = new WebSocket(`ws://${env.WEBSOCKET_HOST}:${env.WEBSOCKET_PORT}`);

    websocket.on('error', (err) => {
        l.error(err);
    });

    websocket.on('open', () => {
        l.stop('Connected to server');
    });

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobsCache = new Map<string, (data: any) => any>();

    const sendJobBack = (jobId: string, data: string | Error, startDate: string) => {
        if (data instanceof Error) {
            websocket.send(`error;${jobId};${data.message};${startDate}`);
            return;
        }
        websocket.send(`completed;${jobId};${JSON.stringify(data)};${startDate}`);
    };

    websocket.on('message', async (message) => {
        const [job, jobId, startDate, strData] = message.toString().split(';');

        l.start('Got job ' + job + ' with id ' + jobId);

        try {
            const data = JSON.parse(strData);

            if (!jobsCache.has(job)) {
                const imported = await import(
                    import.meta.resolve(Path.join(import.meta.dirname, 'tasks', job))
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
        }
    });

    websocket.on('close', () => {
        l.error('Connection closed, reconnecting in 5 seconds');
        //rejoin after 5 seconds
        setTimeout(setupWebSocket, 5 * 1000);
    });
};

setupWebSocket();
