import { WorkerServer } from '$/lib/WorkerServer';
import { Client } from 'discord.js';

declare global {
    namespace NodeJS {
        interface Process {
            workerServer: WorkerServer;
            client: Client;
            lolPatch: string;
        }
    }
}
