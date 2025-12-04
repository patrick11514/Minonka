import { clearAssetCache } from '$/lib/Assets';
import { Cron } from '$/lib/cron';
import Logger from '$/lib/logger';
import { env } from '$/types/env';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const l = new Logger('LolPatch', 'white');

const versionPath = 'assets/ddragon/.version';
const lockPath = 'assets/.update-lock';

const currentVersion = fs.existsSync(versionPath)
    ? fs.readFileSync(versionPath, 'utf-8').trim()
    : '0.0.0';
process.lolPatch = currentVersion;
process.isUpdating = false;

/**
 * Clears cached icon files from the persistent cache directory.
 * This removes generated match images that may contain outdated champion/item icons.
 */
const clearPersistentCache = async (): Promise<void> => {
    const cachePath = env.PERSISTANT_CACHE_PATH;

    try {
        if (!fs.existsSync(cachePath)) {
            l.log('Persistent cache directory does not exist, nothing to clear');
            return;
        }

        const files = await fsPromises.readdir(cachePath);
        let deletedCount = 0;

        for (const file of files) {
            const filePath = path.join(cachePath, file);
            const stat = await fsPromises.stat(filePath);

            if (stat.isFile()) {
                await fsPromises.unlink(filePath);
                deletedCount++;
            } else if (stat.isDirectory()) {
                // Remove directories recursively (e.g., cdragon subdirectories)
                await fsPromises.rm(filePath, { recursive: true });
                deletedCount++;
            }
        }

        l.log(`Cleared ${deletedCount} cached files/directories from persistent cache`);
    } catch (e) {
        l.error(`Failed to clear persistent cache: ${e}`);
    }
};

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
                download.on('exit', async (code) => {
                    if (code !== 0) {
                        l.stopError('Error while updating patch ' + code);
                    } else {
                        l.stop('Patch updated');
                        process.lolPatch = newest;

                        // Clear cached icons to ensure new assets are used
                        clearAssetCache();
                        await clearPersistentCache();

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
