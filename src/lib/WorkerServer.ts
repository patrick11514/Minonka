import { env } from '$/types/env';
import { WebSocket, WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import { SummonerData } from '$/Worker/tasks/summoner';
import Logger from './logger';

enum WorkerState {
    FREE,
    BUSY
}

const Workers: Record<
    string,
    {
        socket: WebSocket;
        state: WorkerState;
    }
> = {};

type Jobs = {
    summoner: SummonerData;
};

const l = new Logger('WorkerServer', 'magenta');

export class WorkerServer {
    private WSS: WebSocketServer;
    private jobs: {
        id: string;
        name: string;
        data: unknown;
    }[] = [];

    private jobResults = new Map<
        string,
        {
            data: unknown;
            elapsed: number;
        }
    >();

    constructor() {
        this.WSS = new WebSocketServer({
            host: env.WEBSOCKET_HOST,
            port: env.WEBSOCKET_PORT
        });

        this.WSS.on('connection', (ws) => {
            const newId = crypto.randomBytes(16).toString('hex');
            Workers[newId] = {
                socket: ws,
                state: WorkerState.FREE
            };

            ws.on('message', (message) => {
                const str = message.toString();
                if (str.startsWith('completed')) {
                    const [, jobId, result, startTimestamp] = str.split(';');
                    Workers[newId].state = WorkerState.FREE;
                    const elapsed = Date.now() - parseInt(startTimestamp);
                    this.jobResults.set(jobId, {
                        data: JSON.parse(result),
                        elapsed
                    });
                } else if (str.startsWith('error')) {
                    const [, jobId, error, startTimestmap] = str.split(';');
                    Workers[newId].state = WorkerState.FREE;
                    const elapsed = Date.now() - parseInt(startTimestmap);
                    this.jobResults.set(jobId, {
                        data: new Error(error),
                        elapsed
                    });
                }
            });

            ws.on('close', () => {
                delete Workers[newId];
            });
        });
    }

    private async schedule() {
        if (this.jobs.length === 0) {
            return;
        }

        this.jobs = this.jobs.filter((job) => {
            const freeWorker = Object.values(Workers).find(
                (worker) => worker.state === WorkerState.FREE
            );

            if (!freeWorker) return true;

            l.log('Started job ' + job.id);

            freeWorker.socket.send(
                job.name +
                    ';' +
                    job.id +
                    ';' +
                    Date.now() +
                    ';' +
                    JSON.stringify(job.data)
            );
            freeWorker.state = WorkerState.BUSY;
            return false;
        });
    }

    addJob<$Job extends keyof Jobs>(jobName: $Job, data: Jobs[$Job]) {
        const jobId = crypto.randomBytes(16).toString('hex');

        this.jobs.push({
            id: jobId,
            name: jobName,
            data
        });

        this.schedule();
        return jobId;
    }

    async wait(jobId: string) {
        return new Promise<string>((resolve, reject) => {
            const interval = setInterval(() => {
                if (this.jobResults.has(jobId)) {
                    clearInterval(interval);
                    const result = this.jobResults.get(jobId)!;
                    if (result instanceof Error) {
                        reject(result);
                    }

                    l.log(`Job ${jobId} completed in ${result.elapsed}ms`);

                    resolve(result.data as string);
                    this.jobResults.delete(jobId);
                }
            }, 100);
        });
    }

    async addJobWait<$Job extends keyof Jobs>(jobName: $Job, data: Jobs[$Job]) {
        const jobId = this.addJob(jobName, data);
        return this.wait(jobId);
    }
}
