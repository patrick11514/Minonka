import { env } from '$/types/env';
import { job, start, stop } from 'microjob';
import Logger from '../logger';

const l = new Logger('ThreadPool', 'cyan');

export class ThreadPool {
    constructor() {
        l.start('Starting thread pool  with ' + env.THREADS + ' threads');
        start({
            maxWorkers: env.THREADS
        }).then(() => {
            l.stop('Started thread pool');
        });
    }

    async stop() {
        l.start('Stopping thread pool');
        await stop();
        l.stop('Stopped thread pool');
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    async runJob(fc: (...args: any[]) => any | Promise<any>) {
        //we need new instance, because for more concurrent jobs, the timers will be mixed
        const localL = new Logger('ThreadPool', 'cyan');
        localL.start('Running new job');
        const result = await job(fc);
        localL.stop('Job completed');
        return result;
    }
}
