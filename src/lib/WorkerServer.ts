import { env } from '$/types/env';
import { FileResult } from '$/types/types';
import { CherryMatchData } from '$/Worker/tasks/cherryMatch';
import { MatchData } from '$/Worker/tasks/match';
import { RankData } from '$/Worker/tasks/rank';
import { SpectatorData } from '$/Worker/tasks/spectator';
import { SummonerData } from '$/Worker/tasks/summoner';
import { TeamData } from '$/Worker/tasks/team';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from './EventEmitter';
import { asyncExists } from './fsAsync';
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
    rank: RankData;
    match: MatchData;
    cherryMatch: CherryMatchData;
    team: TeamData;
    spectator: SpectatorData;
};

const l = new Logger('WorkerServer', 'magenta');

const TIMEOUT = 40 * 1000; // 40s

type JobResult = {
    data: FileResult | Error;
    elapsed: number;
};

type Events = {
    jobDone: (jobId: string, result: JobResult) => void;
};

export class WorkerServer extends EventEmitter<Events> {
    private WSS: WebSocketServer;
    private jobs: {
        id: string;
        name: string;
        data: unknown;
    }[] = [];

    private jobResults = new Map<string, JobResult>();

    constructor() {
        super();

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
                    const jobResult = {
                        data: JSON.parse(result) as FileResult,
                        elapsed
                    };

                    this.jobResults.set(jobId, jobResult);
                    super.emit('jobDone', jobId, jobResult);
                } else if (str.startsWith('error')) {
                    const [, jobId, error, startTimestmap] = str.split(';');
                    Workers[newId].state = WorkerState.FREE;
                    const elapsed = Date.now() - parseInt(startTimestmap);
                    const jobResult = {
                        data: new Error(error),
                        elapsed
                    };

                    this.jobResults.set(jobId, jobResult);
                    super.emit('jobDone', jobId, jobResult);
                } else if (str.startsWith('checkPersistent')) {
                    // Handle persistent file existence check
                    const [, requestId, fileName] = str.split(';');
                    const exists = asyncExists(
                        `${env.PERSISTANT_CACHE_PATH}/${fileName}`
                    );
                    exists
                        .then((result) => {
                            ws.send(`persistentResult;${requestId};${result}`);
                        })
                        .catch(() => {
                            ws.send(`persistentResult;${requestId};false`);
                        });
                }
                this.schedule();
            });

            ws.on('close', () => {
                delete Workers[newId];
            });
        });
    }

    private schedule() {
        if (Object.keys(Workers).length === 0) {
            //we should clear job list, because we have no workers
            this.jobs = [];
            throw new Error('No workers available');
        }

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

    private async handleFileResult(result: FileResult): Promise<string> {
        if (result.type === 'local') {
            // Already a local file path, return as-is
            return result.path;
        }

        if (result.type === 'temp') {
            const buffer = Buffer.from(result.data, 'base64');

            // Save to temporary cache directory
            if (!(await asyncExists(env.CACHE_PATH))) {
                await fs.mkdir(env.CACHE_PATH, { recursive: true });
            }

            const name = crypto.randomBytes(16).toString('hex');
            const filePath = `${env.CACHE_PATH}/${name}.png`;

            await fs.writeFile(filePath, buffer);
            return filePath;
        }

        // Decode base64 data to buffer
        if (result.data === undefined) {
            //the file is already present, so just return the path
            return `${env.PERSISTANT_CACHE_PATH}/${result.name}`;
        }

        const buffer = Buffer.from(result.data, 'base64');

        // Save to persistent cache directory
        if (!(await asyncExists(env.PERSISTANT_CACHE_PATH))) {
            await fs.mkdir(env.PERSISTANT_CACHE_PATH, { recursive: true });
        }

        const filePath = `${env.PERSISTANT_CACHE_PATH}/${result.name}`;
        await fs.writeFile(filePath, buffer);
        return filePath;
    }

    async wait(jobId: string) {
        if (this.jobResults.has(jobId)) {
            const result = this.jobResults.get(jobId)!;

            //remove, since we got it
            this.jobResults.delete(jobId);

            if (result.data instanceof Error) {
                throw result.data;
            }

            return this.handleFileResult(result.data);
        }

        const result = await Promise.race([
            new Promise<string>((resolve, reject) => {
                const checkJob = async (id: string, result: JobResult) => {
                    if (id !== jobId) return;
                    //remove job from map, because we got it using the event
                    this.jobResults.delete(jobId);
                    super.clearEvent('jobDone', checkJob);

                    if (result.data instanceof Error) {
                        reject(result.data);
                        return;
                    }

                    l.log(`Job ${jobId} completed in ${result.elapsed}ms`);

                    try {
                        const filePath = await this.handleFileResult(result.data);
                        resolve(filePath);
                    } catch (error) {
                        reject(error);
                    }
                };

                super.on('jobDone', checkJob);
            }),
            new Promise<undefined>((resolve) => setTimeout(resolve, TIMEOUT))
        ]);

        if (result === undefined) {
            throw new Error('Job timedouted');
        }

        return result;
    }

    async addJobWait<$Job extends keyof Jobs>(jobName: $Job, data: Jobs[$Job]) {
        const jobId = this.addJob(jobName, data);

        return this.wait(jobId);
    }

    removeJob(jobId: string) {
        l.log('Removing job ' + jobId);
        this.jobs = this.jobs.filter((job) => job.id !== jobId);
        this.jobResults.delete(jobId);
    }
}
