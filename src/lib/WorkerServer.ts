import { env } from '$/types/env';
import { WebSocket, WebSocketServer } from 'ws';
import crypto from 'node:crypto';
import { SummonerData } from '$/Worker/tasks/summoner';
import Logger from './logger';
import { EventEmitter } from './EventEmitter';
import { RankData } from '$/Worker/tasks/rank';
import { MatchData } from '$/Worker/tasks/match';
import { TeamData } from '$/Worker/tasks/team';

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
    team: TeamData;
};

const l = new Logger('WorkerServer', 'magenta');

const TIMEOUT = 20 * 1000; // 20s

type JobResult = {
    data: unknown;
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
                        data: JSON.parse(result),
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

    async wait(jobId: string) {
        if (this.jobResults.has(jobId)) {
            const result = this.jobResults.get(jobId)!;

            //remove, since we got it
            this.jobResults.delete(jobId);

            if (result instanceof Error) {
                throw result;
            }

            return result.data as string;
        }

        const result = await Promise.race([
            new Promise<string>((resolve, reject) => {
                const checkJob = (id: string, result: JobResult) => {
                    if (id !== jobId) return;
                    //remove job from map, because we got it using the event
                    this.jobResults.delete(jobId);
                    super.clearEvent('jobDone', checkJob);

                    if (result.data instanceof Error) {
                        reject(result.data);
                    }

                    l.log(`Job ${jobId} completed in ${result.elapsed}ms`);

                    resolve(result.data as string);
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
}
