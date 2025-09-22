import fs from 'node:fs/promises';
import { asyncExists } from './fsAsync';
import Logger from './logger';

const l = new Logger('LockFile', 'cyan');

export interface LockInfo {
    pid: number;
    timestamp: number;
    instanceId?: string;
}

export class LockFile {
    private lockPath: string;
    private maxAge: number; // Maximum age in milliseconds before lock is considered stale
    private isLocked: boolean = false;

    constructor(lockPath: string, maxAge: number = 30 * 60 * 1000) {
        // Default 30 minutes
        this.lockPath = lockPath;
        this.maxAge = maxAge;
    }

    /**
     * Acquire lock, returns true if successful, false if lock already exists and is valid
     */
    async acquire(): Promise<boolean> {
        try {
            // Create lock file with exclusive write access - this is atomic
            const lockInfo: LockInfo = {
                pid: process.pid,
                timestamp: Date.now(),
                instanceId: process.env.INSTANCE_ID
            };

            try {
                // Use exclusive write mode to prevent race conditions
                await fs.writeFile(this.lockPath, JSON.stringify(lockInfo, null, 2), {
                    flag: 'wx'
                });
                this.isLocked = true;
                l.log(`Acquired lock at ${this.lockPath}`);
                return true;
            } catch (error: unknown) {
                if (
                    error instanceof Error &&
                    'code' in error &&
                    error.code === 'EEXIST'
                ) {
                    // File exists, check if it's a valid lock
                    const isValid = await this.isLockValid();
                    if (isValid) {
                        l.log(`Lock already exists at ${this.lockPath}`);
                        return false;
                    }
                    // Lock is stale, remove it and try again
                    await this.forceRemoveLock();
                    l.log(`Removed stale lock at ${this.lockPath}`);

                    // Try one more time to create the lock
                    try {
                        await fs.writeFile(
                            this.lockPath,
                            JSON.stringify(lockInfo, null, 2),
                            { flag: 'wx' }
                        );
                        this.isLocked = true;
                        l.log(
                            `Acquired lock at ${this.lockPath} after removing stale lock`
                        );
                        return true;
                    } catch (secondError: unknown) {
                        if (
                            secondError instanceof Error &&
                            'code' in secondError &&
                            secondError.code === 'EEXIST'
                        ) {
                            l.log(
                                `Another process acquired lock while cleaning up stale lock`
                            );
                            return false;
                        }
                        throw secondError;
                    }
                }
                throw error;
            }
        } catch (error) {
            l.error(`Failed to acquire lock: ${error}`);
            return false;
        }
    }

    /**
     * Force remove lock file without checking ownership (for stale lock cleanup)
     */
    private async forceRemoveLock(): Promise<void> {
        try {
            await fs.unlink(this.lockPath);
        } catch {
            // File doesn't exist or permission error, ignore
        }
    }

    /**
     * Release the lock if it belongs to this process
     */
    async release(): Promise<void> {
        try {
            if (await asyncExists(this.lockPath)) {
                const lockContent = await fs.readFile(this.lockPath, 'utf-8');
                const lockInfo: LockInfo = JSON.parse(lockContent);

                // Only release if the lock belongs to this process
                if (lockInfo.pid === process.pid) {
                    await fs.unlink(this.lockPath);
                    l.log(`Released lock at ${this.lockPath}`);
                } else {
                    l.log(
                        `Lock does not belong to this process (PID: ${process.pid}, Lock PID: ${lockInfo.pid})`
                    );
                }
            }
        } catch (error) {
            l.error(`Failed to release lock: ${error}`);
        }
    }

    /**
     * Check if the current lock is valid (not stale)
     */
    private async isLockValid(): Promise<boolean> {
        try {
            const lockContent = await fs.readFile(this.lockPath, 'utf-8');
            const lockInfo: LockInfo = JSON.parse(lockContent);

            // Check if lock is too old
            const age = Date.now() - lockInfo.timestamp;
            if (age > this.maxAge) {
                l.log(
                    `Lock is stale (age: ${Math.round(age / 1000)}s, max: ${Math.round(this.maxAge / 1000)}s)`
                );
                return false;
            }

            // Check if process is still running (only works on Unix-like systems)
            try {
                process.kill(lockInfo.pid, 0); // Signal 0 checks if process exists
                return true;
            } catch {
                l.log(`Process ${lockInfo.pid} no longer exists`);
                return false;
            }
        } catch (error) {
            l.error(`Failed to validate lock: ${error}`);
            return false;
        }
    }

    /**
     * Wait for lock to be available with timeout and retries
     */
    async waitForLock(
        timeoutMs: number = 5 * 60 * 1000,
        retryIntervalMs: number = 5000
    ): Promise<boolean> {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            if (await this.acquire()) {
                return true;
            }

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
        }

        l.error(`Timeout waiting for lock after ${timeoutMs}ms`);
        return false;
    }
}
