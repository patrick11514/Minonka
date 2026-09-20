import http from 'node:http';
import assert from 'node:assert';
import test from 'node:test';
import { z } from 'zod';
import { baseRequest } from './baseRequest';
import { requestPacer } from './rateLimiter';

test('baseRequest retries on 429 and waits for Retry-After', async () => {
    requestPacer.reset();

    let requestCount = 0;
    const server = http.createServer((req, res) => {
        requestCount++;
        if (requestCount === 1) {
            // First attempt: return 429 with Retry-After: 0.1 (100ms)
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': '1',
                'X-Rate-Limit-Type': 'application'
            });
            res.end(
                JSON.stringify({
                    status: { message: 'Rate limit exceeded', status_code: 429 }
                })
            );
        } else {
            // Second attempt: succeed
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'success' }));
        }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}/test`;

    const schema = z.object({ message: z.string() });

    try {
        const response = await baseRequest(url, schema);

        assert.strictEqual(response.status, true);
        if (response.status) {
            assert.strictEqual(response.data.message, 'success');
        }
        assert.strictEqual(requestCount, 2);
    } finally {
        server.close();
        requestPacer.reset();
    }
});

test('baseRequest concurrent requests pause together when one hits 429', async () => {
    requestPacer.reset();

    let serverRequestCount = 0;
    const server = http.createServer((req, res) => {
        serverRequestCount++;
        if (serverRequestCount === 1) {
            // First request hits 429 with Retry-After 1s
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': '1'
            });
            res.end(JSON.stringify({ message: 'Rate limit' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: `ok_${serverRequestCount}` }));
        }
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}/test`;
    const schema = z.object({ message: z.string() });

    try {
        const start = Date.now();
        // Simulate: await Promise.all([req1, req2, req3])
        const results = await Promise.all([
            baseRequest(url, schema),
            baseRequest(url, schema),
            baseRequest(url, schema)
        ]);

        const elapsed = Date.now() - start;

        // All 3 requests should eventually succeed
        for (const res of results) {
            assert.strictEqual(res.status, true);
        }

        // Since request 1 hit 429 with Retry-After: 1s, it should have waited ~1250ms
        assert.ok(elapsed >= 1000, `Expected elapsed >= 1000ms, got ${elapsed}ms`);
        // Total server requests: Req 1 (429), Req 1 retry (200), Req 2 (200), Req 3 (200) = 4
        assert.strictEqual(serverRequestCount, 4);
    } finally {
        server.close();
        requestPacer.reset();
    }
});
