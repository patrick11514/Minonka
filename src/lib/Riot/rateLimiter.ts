export function parseRetryAfter(
    header: string | null | undefined,
    now: number = Date.now()
): number {
    if (!header) {
        return 1;
    }

    const parsedSeconds = parseFloat(header);
    if (!isNaN(parsedSeconds) && parsedSeconds > 0) {
        return parsedSeconds;
    }

    const parsedDate = Date.parse(header);
    if (!isNaN(parsedDate)) {
        const diffSeconds = (parsedDate - now) / 1000;
        return diffSeconds > 0 ? Math.ceil(diffSeconds) : 1;
    }

    return 1;
}

export class RequestPacer {
    private rateLimitUntil = 0;
    private nextAvailableTime = 0;
    private readonly minIntervalMs: number;

    constructor(minIntervalMs = 50) {
        this.minIntervalMs = minIntervalMs;
    }

    public setRateLimit(retryAfterSeconds: number): void {
        const waitMs = Math.max(1, retryAfterSeconds) * 1000 + 250;
        const newUntil = Date.now() + waitMs;
        if (newUntil > this.rateLimitUntil) {
            this.rateLimitUntil = newUntil;
        }
        if (newUntil > this.nextAvailableTime) {
            this.nextAvailableTime = newUntil;
        }
    }

    public isRateLimited(): boolean {
        return Date.now() < this.rateLimitUntil;
    }

    public getRemainingWaitMs(): number {
        return Math.max(0, this.rateLimitUntil - Date.now());
    }

    public reset(): void {
        this.rateLimitUntil = 0;
        this.nextAvailableTime = 0;
    }

    public async waitForSlot(): Promise<void> {
        while (true) {
            const now = Date.now();
            if (now < this.rateLimitUntil) {
                const waitMs = this.rateLimitUntil - now;
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                continue;
            }

            const scheduledTime = Math.max(now, this.nextAvailableTime);
            this.nextAvailableTime = scheduledTime + this.minIntervalMs;

            const delay = scheduledTime - now;
            if (delay > 0) {
                await new Promise((resolve) => setTimeout(resolve, delay));
            }

            // If another request hit rate limit while we were waiting for pacing, wait again
            if (Date.now() < this.rateLimitUntil) {
                continue;
            }

            break;
        }
    }
}

export const requestPacer = new RequestPacer();
