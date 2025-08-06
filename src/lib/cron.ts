import { Awaitable } from '$/types/types';
import cron from 'node-cron';
import fs from 'node:fs/promises';
import path from 'node:path';
import Logger from './logger';

export type Cron =
    | [string, () => Awaitable<void>]
    | [string, () => Awaitable<void>, cron.ScheduleOptions];

const l = new Logger('Cron', 'blue');

export const registerCrons = async (cronFilter?: string[]) => {
    const crons = await fs.readdir(path.join(import.meta.dirname, '../crons'));
    let filteredCrons = crons;

    if (cronFilter) {
        filteredCrons = crons.filter((cron) => {
            const cronName = path.basename(
                cron,
                process.env.NODE_ENV === 'production' ? '.js' : '.ts'
            );
            return cronFilter.includes(cronName);
        });
    }

    l.start(`Registering ${filteredCrons.length} crons...`);
    const promises = filteredCrons.map(
        (cron) => import(import.meta.resolve(path.join('../crons', cron)))
    );
    const resolved = await Promise.all(promises);
    const defaults = resolved.map((r) => r.default);
    const filter = defaults.filter(
        (d) =>
            d instanceof Array && typeof d[0] === 'string' && typeof d[1] === 'function'
    ) as Cron[];
    for (const arr of filter) {
        cron.schedule(arr[0], arr[1], arr[2] ?? {});
    }

    l.stop(`Registered ${filter.length} crons`);
};

export const batchPromises = async <$ReturnType>(
    promises: (() => Awaitable<$ReturnType>)[],
    batchSize: number,
    waitTime: number
): Promise<$ReturnType[]> => {
    const batches = [];
    for (let i = 0; i < promises.length; i += batchSize) {
        batches.push(promises.slice(i, i + batchSize));
    }

    const results = [];
    for (const batch of batches) {
        const batchResults = await Promise.all(batch.map((p) => p()));
        results.push(...batchResults);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    return results;
};
