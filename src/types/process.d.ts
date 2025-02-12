import { WorkerServer } from '$/lib/WorkerServer';

declare global {
    namespace NodeJS {
        interface Process {
            workerServer: WorkerServer;
        }
    }
}
