import assert from 'node:assert';
import test from 'node:test';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebServer } from './WebServer';

test('WebServer routes and page rendering', async (t) => {
    const webServer = new WebServer();
    let server: Server;
    let baseUrl: string;

    await t.test('start server on ephemeral port', async () => {
        server = await new Promise((resolve) => {
            const s = webServer.app.listen(0, '127.0.0.1', () => resolve(s));
        });
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
    });

    await t.test(
        'GET / returns landing page with 2 buttons and contact footer',
        async () => {
            const res = await fetch(`${baseUrl}/`);
            assert.strictEqual(res.status, 200);
            assert.ok(res.headers.get('content-type')?.includes('text/html'));
            const html = await res.text();

            // Check dark design without gradients
            assert.ok(html.includes('#121212'));
            assert.ok(!html.includes('linear-gradient'));
            assert.ok(!html.includes('radial-gradient'));

            // Check 2 buttons
            assert.ok(html.includes('href="/terms"'));
            assert.ok(html.includes('href="/privacy"'));
            assert.ok(html.includes('Podmínky využívání služeb'));
            assert.ok(html.includes('Zásady ochrany osobních údajů'));

            // Check contact footer
            assert.ok(html.includes('patrik@mintel.cz'));
            assert.ok(html.includes('https://patrik.mintel.cz'));
        }
    );

    await t.test(
        'GET /terms returns Czech Terms by default and English when requested',
        async () => {
            const resCs = await fetch(`${baseUrl}/terms`);
            assert.strictEqual(resCs.status, 200);
            const htmlCs = await resCs.text();
            assert.ok(htmlCs.includes('Podmínky využívání služeb'));
            assert.ok(htmlCs.includes('Minonka isn’t endorsed by Riot Games'));
            assert.ok(htmlCs.includes('patrik@mintel.cz'));
            assert.ok(htmlCs.includes('https://patrik.mintel.cz'));

            const resEn = await fetch(`${baseUrl}/terms?lang=en`);
            assert.strictEqual(resEn.status, 200);
            const htmlEn = await resEn.text();
            assert.ok(htmlEn.includes('Terms of Service'));
            assert.ok(htmlEn.includes('Acceptable Use'));

            // Aliases
            const resTos = await fetch(`${baseUrl}/tos`);
            assert.strictEqual(resTos.status, 200);
            const resPodminky = await fetch(`${baseUrl}/podminky`);
            assert.strictEqual(resPodminky.status, 200);
        }
    );

    await t.test(
        'GET /privacy returns Czech Privacy Policy by default and English when requested',
        async () => {
            const resCs = await fetch(`${baseUrl}/privacy`);
            assert.strictEqual(resCs.status, 200);
            const htmlCs = await resCs.text();
            assert.ok(htmlCs.includes('Zásady ochrany osobních údajů'));
            assert.ok(htmlCs.includes('Discord User ID'));
            assert.ok(htmlCs.includes('patrik@mintel.cz'));
            assert.ok(htmlCs.includes('https://patrik.mintel.cz'));

            const resEn = await fetch(`${baseUrl}/privacy?lang=en`);
            assert.strictEqual(resEn.status, 200);
            const htmlEn = await resEn.text();
            assert.ok(htmlEn.includes('Privacy Policy'));
            assert.ok(htmlEn.includes('Data We Collect'));

            // Alias
            const resZasady = await fetch(`${baseUrl}/zasady`);
            assert.strictEqual(resZasady.status, 200);
        }
    );

    await t.test('GET /health returns status ok', async () => {
        const res = await fetch(`${baseUrl}/health`);
        assert.strictEqual(res.status, 200);
        const json = (await res.json()) as { status: string };
        assert.deepStrictEqual(json, { status: 'ok' });
    });

    await t.test('close server', async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((err) => (err ? reject(err) : resolve()));
        });
    });

    await t.test('WebServer.start binds to configured host (0.0.0.0)', async () => {
        const standaloneServer = new WebServer();
        const s = await standaloneServer.start();
        const address = s.address() as AddressInfo;
        assert.strictEqual(address.address, '0.0.0.0');
        await standaloneServer.stop();
    });
});
