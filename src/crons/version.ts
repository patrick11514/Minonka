import { Cron } from '$/lib/cron';
import Logger from '$/lib/logger';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const l = new Logger('LolPatch', 'white');

const versionPath = 'assets/ddragon/.version';
const lockPath = 'assets/.update-lock';

const currentVersion = fs.existsSync(versionPath)
    ? fs.readFileSync(versionPath, 'utf-8').trim()
    : '0.0.0';
process.lolPatch = currentVersion;
process.isUpdating = false;

export default [
    '0 0 */2 * * *',
    async () => {
        l.start('Checking for new patch');

        // Check if update is already in progress
        if (fs.existsSync(lockPath)) {
            l.stop('Another worker is already updating, waiting for completion...');
            process.isUpdating = true;

            // Wait for lock file to be removed
            const MAX_WAIT_MS = 5 * 60 * 1000; // 5 minutes
            await new Promise<void>((resolve, reject) => {
                const start = Date.now();
                const checkInterval = setInterval(() => {
                    if (!fs.existsSync(lockPath)) {
                        clearInterval(checkInterval);
                        clearTimeout(timeout);
                        process.isUpdating = false;
                        l.stop('Update completed by another worker');
                        resolve();
                    }
                }, 1000); // Check every second
                const timeout = setTimeout(() => {
                    clearInterval(checkInterval);
                    process.isUpdating = false;
                    l.stopError(
                        `Timeout waiting for update lock file to be removed after ${MAX_WAIT_MS / 1000 / 60} minutes`
                    );
                    reject(
                        new Error('Timeout waiting for update lock file to be removed')
                    );
                }, MAX_WAIT_MS);
            });
            return;
        }

        try {
            const response = await fetch(
                'https://ddragon.leagueoflegends.com/api/versions.json'
            );
            const newest = (await response.json())[0];
            if (newest !== process.lolPatch) {
                //run subprocess, which will update it
                process.patching = true;
                process.isUpdating = true;

                l.log('New patch found, updating');
                const download = spawn('bash', ['assets/download.sh'], {
                    cwd: process.cwd()
                });
                download.on('exit', (code) => {
                    if (code !== 0) {
                        l.stopError('Error while updating patch ' + code);
                    } else {
                        l.stop('Patch updated');
                        process.lolPatch = newest;

                        //if we are in remote woker, we don't need to sync emojis, because
                        //its just the worker
                        if (process.env.WORKER_MODE !== 'remote') {
                            //sync emojis
                            process.emoji.sync();
                        }
                    }
                    process.patching = false;
                    process.isUpdating = false;
                });
            } else {
                l.stop('No new patch found');
            }
        } catch (e) {
            l.stopError('Error while checking for new patch ' + e);

            process.discordBot.handleError(e, 'LolPatch Cron');
        }
    },
    {
        runOnInit: true
    }
] satisfies Cron;
