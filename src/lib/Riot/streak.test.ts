import assert from 'node:assert';
import test from 'node:test';
import api from './api';
import {
    clearStreakCache,
    getCachedMatchOutcome,
    getRecentStreakForQueue,
    setCachedMatchOutcome
} from './streak';

test('streak cache operations', () => {
    clearStreakCache();

    assert.strictEqual(getCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1'), undefined);

    setCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1', true);
    assert.strictEqual(getCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1'), true);

    setCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1', false);
    assert.strictEqual(getCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1'), false);

    clearStreakCache();
    assert.strictEqual(getCachedMatchOutcome('EUN1', 'MATCH_1', 'PUUID_1'), undefined);
});

test('getRecentStreakForQueue returns null when fewer than 3 matches exist', async () => {
    clearStreakCache();
    const originalIds = api.EUN1.match.ids;
    try {
        api.EUN1.match.ids = (async () => ({
            status: true,
            data: ['M1', 'M2']
        })) as unknown as typeof api.EUN1.match.ids;

        const result = await getRecentStreakForQueue('PUUID_TEST', 'EUN1', 420);
        assert.strictEqual(result, null);
    } finally {
        api.EUN1.match.ids = originalIds;
    }
});

test('getRecentStreakForQueue stops early after 3 matches when mixed outcomes', async () => {
    clearStreakCache();
    const originalIds = api.EUN1.match.ids;
    const originalMatch = api.EUN1.match.match;
    let matchCalls = 0;

    try {
        api.EUN1.match.ids = (async () => ({
            status: true,
            data: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10']
        })) as unknown as typeof api.EUN1.match.ids;

        api.EUN1.match.match = (async (matchId: string) => {
            matchCalls++;
            // M1: win, M2: loss, M3: win
            const isWin = matchId !== 'M2';
            return {
                status: true,
                data: {
                    info: {
                        participants: [{ puuid: 'PUUID_TEST', win: isWin }]
                    }
                }
            };
        }) as unknown as typeof api.EUN1.match.match;

        const result = await getRecentStreakForQueue('PUUID_TEST', 'EUN1', 420);
        assert.strictEqual(result, null);
        // Crucial verification: it only fetched M1, M2, M3 and stopped! Did not fetch M4..M10!
        assert.strictEqual(matchCalls, 3);
    } finally {
        api.EUN1.match.ids = originalIds;
        api.EUN1.match.match = originalMatch;
    }
});

test('getRecentStreakForQueue calculates win streak >= 3 and stops when streak breaks', async () => {
    clearStreakCache();
    const originalIds = api.EUN1.match.ids;
    const originalMatch = api.EUN1.match.match;
    let matchCalls = 0;

    try {
        api.EUN1.match.ids = (async () => ({
            status: true,
            data: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6']
        })) as unknown as typeof api.EUN1.match.ids;

        api.EUN1.match.match = (async (matchId: string) => {
            matchCalls++;
            // M1..M4 are wins, M5 is loss
            const isWin = matchId !== 'M5';
            return {
                status: true,
                data: {
                    info: {
                        participants: [{ puuid: 'PUUID_TEST', win: isWin }]
                    }
                }
            };
        }) as unknown as typeof api.EUN1.match.match;

        const result = await getRecentStreakForQueue('PUUID_TEST', 'EUN1', 420);
        assert.deepStrictEqual(result, { type: 'win', count: 4 });
        // It should have fetched chunk 1 (M1, M2, M3 = 3) + chunk 2 (M4, M5, M6 = 3) = 6 calls
        assert.strictEqual(matchCalls, 6);
    } finally {
        api.EUN1.match.ids = originalIds;
        api.EUN1.match.match = originalMatch;
    }
});

test('getRecentStreakForQueue uses cached match outcomes without refetching', async () => {
    clearStreakCache();
    const originalIds = api.EUN1.match.ids;
    const originalMatch = api.EUN1.match.match;
    let matchCalls = 0;

    try {
        // Pre-populate cache for M1 and M2
        setCachedMatchOutcome('EUN1', 'M1', 'PUUID_TEST', true);
        setCachedMatchOutcome('EUN1', 'M2', 'PUUID_TEST', true);

        api.EUN1.match.ids = (async () => ({
            status: true,
            data: ['M1', 'M2', 'M3']
        })) as unknown as typeof api.EUN1.match.ids;

        api.EUN1.match.match = (async () => {
            matchCalls++;
            return {
                status: true,
                data: {
                    info: {
                        participants: [{ puuid: 'PUUID_TEST', win: true }]
                    }
                }
            };
        }) as unknown as typeof api.EUN1.match.match;

        const result = await getRecentStreakForQueue('PUUID_TEST', 'EUN1', 420);
        assert.deepStrictEqual(result, { type: 'win', count: 3 });
        // Only M3 had to be fetched via api because M1 and M2 were cached!
        assert.strictEqual(matchCalls, 1);
    } finally {
        api.EUN1.match.ids = originalIds;
        api.EUN1.match.match = originalMatch;
    }
});
