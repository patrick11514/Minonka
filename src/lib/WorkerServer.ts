import { env } from '$/types/env';
import { CherryMatchTaskInput } from '$/types/worker/CherryMatchTaskInput';
import { FileResult } from '$/types/worker/FileResult';
import { MatchTaskInput } from '$/types/worker/MatchTaskInput';
import { RankTaskInput } from '$/types/worker/RankTaskInput';
import { SummonerTaskInput } from '$/types/worker/SummonerTaskInput';
import { TeamTaskInput } from '$/types/worker/TeamTaskInput';
import { SpectatorTaskInput } from '$/types/worker/SpectatorTaskInput';
import { GraphTaskInput } from '$/types/worker/GraphTaskInput';
import assert from 'node:assert';
import crypto from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from './EventEmitter';
import { asyncExists } from './fsAsync';
import Logger from './logger';

type Jobs = {
    summoner: SummonerTaskInput;
    rank: RankTaskInput;
    match: MatchTaskInput;
    cherryMatch: CherryMatchTaskInput;
    team: TeamTaskInput;
    spectator: SpectatorTaskInput;
    graph: GraphTaskInput;
};

const l = new Logger('WorkerServer', 'magenta');

const TIMEOUT = 40 * 1000; // 40s

type JobResult = {
    data: FileResult | ErrorWithStack;
    elapsed: number;
};

type Events = {
    jobDone: (jobId: string, result: JobResult) => void;
};

class ErrorWithStack extends Error {
    constructor(message: string, stack: string) {
        super(message);
        this.stack = stack;
    }
}

export class WorkerServer extends EventEmitter<Events> {
    private WSS: WebSocketServer;
    private workerSocket: WebSocket | null = null;
    private jobResults = new Map<string, JobResult>();

    constructor() {
        super();

        this.WSS = new WebSocketServer({
            host: env.WEBSOCKET_SERVER_HOST,
            port: env.WEBSOCKET_SERVER_PORT
        });

        this.WSS.on('connection', (ws) => {
            if (this.workerSocket) {
                l.log('Replacing existing worker connection');
                this.workerSocket.close();
            }
            this.workerSocket = ws;

            ws.on('message', (message) => {
                const str = message.toString();
                if (str.startsWith('completed')) {
                    const [, jobId, result, startTimestamp] = str.split(';');
                    const elapsed = Date.now() - parseInt(startTimestamp);
                    const jobResult = {
                        data: JSON.parse(result) as FileResult,
                        elapsed
                    };

                    this.jobResults.set(jobId, jobResult);
                    super.emit('jobDone', jobId, jobResult);
                } else if (str.startsWith('error')) {
                    const [, jobId, message, stack, startTimestmap] = str.split(';');
                    const elapsed = Date.now() - parseInt(startTimestmap);
                    const jobResult = {
                        data: new ErrorWithStack(message, stack),
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
            });

            ws.on('close', () => {
                if (this.workerSocket === ws) {
                    this.workerSocket = null;
                }
            });
        });
    }

    addJob<$Job extends keyof Jobs>(jobName: $Job, data: Jobs[$Job]) {
        if (process.isUpdating) {
            throw new Error(
                'Assets are currently being updated due to new version of League of Legends, please execute this command later again.'
            );
        }

        if (!this.workerSocket) {
            throw new Error('No worker available');
        }

        const jobId = crypto.randomBytes(16).toString('hex');

        l.log('Started job ' + jobId);

        this.workerSocket.send(
            jobName + ';' + jobId + ';' + Date.now() + ';' + JSON.stringify(data)
        );

        return jobId;
    }

    private async handleFileResult(result: FileResult): Promise<string> {
        assert(result.type === 'local', 'Unknown FileResult type');

        return result.path;
    }

    async wait(jobId: string) {
        if (this.jobResults.has(jobId)) {
            const result = this.jobResults.get(jobId)!;

            //remove, since we got it
            this.jobResults.delete(jobId);

            if (result.data instanceof ErrorWithStack) {
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
        this.jobResults.delete(jobId);
    }
}
