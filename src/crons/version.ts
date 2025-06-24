import { Cron } from '$/lib/cron';
import Logger from '$/lib/logger';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const l = new Logger('LolPatch', 'white');

const versionPath = 'assets/ddragon/.version';

const currentVersion = fs.existsSync(versionPath)
    ? fs.readFileSync(versionPath, 'utf-8').trim()
    : '0.0.0';
process.lolPatch = currentVersion;

export default [
    '0 0 */2 * * *',
    async () => {
        l.start('Checking for new patch');
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
                download.on('exit', (code) => {
                    if (code !== 0) {
                        l.stopError('Error while updating patch ' + code);
                    } else {
                        l.stop('Patch updated');
                        process.patching = false;
                        process.lolPatch = newest;
                        //sync emojis
                        process.emoji.sync();
                    }
                });
            } else {
                l.stop('No new patch found');
            }
        } catch (e) {
            l.stopError('Error while checking for new patch ' + e);
        }
    },
    {
        runOnInit: true
    }
] satisfies Cron;
