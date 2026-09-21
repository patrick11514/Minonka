import assert from 'node:assert';
import test from 'node:test';
import { parseRetryAfter, RequestPacer } from './rateLimiter';

test('parseRetryAfter parses numeric seconds', () => {
    assert.strictEqual(parseRetryAfter('5'), 5);
    assert.strictEqual(parseRetryAfter('1.5'), 1.5);
    assert.strictEqual(parseRetryAfter('120'), 120);
});

test('parseRetryAfter defaults to 1 for empty or invalid headers', () => {
    assert.strictEqual(parseRetryAfter(null), 1);
    assert.strictEqual(parseRetryAfter(undefined), 1);
    assert.strictEqual(parseRetryAfter(''), 1);
    assert.strictEqual(parseRetryAfter('-5'), 1);
    assert.strictEqual(parseRetryAfter('invalid'), 1);
});

test('parseRetryAfter handles HTTP-date format', () => {
    const now = Date.now();
    const futureDate = new Date(now + 10000).toUTCString();
    const parsed = parseRetryAfter(futureDate, now);
    assert.strictEqual(parsed, 10);
});

test('RequestPacer paces consecutive requests', async () => {
    const pacer = new RequestPacer(20);
    const start = Date.now();

    await Promise.all([pacer.waitForSlot(), pacer.waitForSlot(), pacer.waitForSlot()]);

    const elapsed = Date.now() - start;
    // 3 requests spaced by 20ms should take at least 35ms (slot 0 at 0, slot 1 at 20, slot 2 at 40)
    assert.ok(elapsed >= 35, `Expected elapsed >= 35ms, got ${elapsed}ms`);
});

test('RequestPacer pauses when rate limit is set', async () => {
    const pacer = new RequestPacer(10);
    assert.strictEqual(pacer.isRateLimited(), false);

    // Set rate limit for 0.1 seconds (100ms)
    // Note: setRateLimit adds 250ms buffer, waitMs = Math.max(1, 0.1)*1000 + 250 = 1250ms
    // Let's test with a small custom calculation
    pacer.setRateLimit(0.05);
    assert.strictEqual(pacer.isRateLimited(), true);
    assert.ok(pacer.getRemainingWaitMs() > 0);

    pacer.reset();
    assert.strictEqual(pacer.isRateLimited(), false);
    assert.strictEqual(pacer.getRemainingWaitMs(), 0);
});

test('RequestPacer holds back waiting requests when rate limited', async () => {
    const pacer = new RequestPacer(5);
    let requestExecuted = false;

    // Simulate rate limit set by earlier request
    pacer.setRateLimit(0.05); // sets wait

    // Reset nextAvailableTime but keep rateLimitUntil short
    pacer.reset();
    // Artificially set rateLimitUntil to 50ms in the future
    (pacer as unknown as { rateLimitUntil: number }).rateLimitUntil = Date.now() + 50;

    const start = Date.now();
    await pacer.waitForSlot();
    requestExecuted = true;
    const elapsed = Date.now() - start;

    assert.strictEqual(requestExecuted, true);
    assert.ok(elapsed >= 40, `Expected elapsed >= 40ms, got ${elapsed}ms`);
});
