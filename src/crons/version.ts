import { Cron } from '$/lib/cron';
import { LockFile } from '$/lib/lockFile';
import Logger from '$/lib/logger';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const l = new Logger('LolPatch', 'white');

const versionPath = 'assets/ddragon/.version';
const lockFile = new LockFile('assets/.update-lock', 30 * 60 * 1000); // 30 minutes timeout

const currentVersion = fs.existsSync(versionPath)
    ? fs.readFileSync(versionPath, 'utf-8').trim()
    : '0.0.0';
process.lolPatch = currentVersion;

export default [
    '0 0 */2 * * *',
    async () => {
        l.start('Checking for new patch');

        // Try to acquire lock before checking for updates
        const lockAcquired = await lockFile.acquire();
        if (!lockAcquired) {
            l.stop('Another worker is already updating, skipping');
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

                l.log('New patch found, updating');
                const download = spawn('bash', ['assets/download.sh'], {
                    cwd: process.cwd()
                });

                download.on('exit', async (code) => {
                    try {
                        if (code !== 0) {
                            l.stopError('Error while updating patch ' + code);
                        } else {
                            l.stop('Patch updated');
                            process.patching = false;
                            process.lolPatch = newest;

                            //if we are in remote woker, we don't need to sync emojis, because
                            //its just the worker
                            if (process.env.WORKER_MODE !== 'remote') {
                                //sync emojis
                                process.emoji.sync();
                            }
                        }
                    } finally {
                        // Always release the lock when update is complete
                        await lockFile.release();
                    }
                });
            } else {
                l.stop('No new patch found');
                // Release lock immediately if no update needed
                await lockFile.release();
            }
        } catch (e) {
            l.stopError('Error while checking for new patch ' + e);
            // Release lock on error
            await lockFile.release();
            process.discordBot.handleError(e, 'LolPatch Cron');
        }
    },
    {
        runOnInit: true
    }
] satisfies Cron;
