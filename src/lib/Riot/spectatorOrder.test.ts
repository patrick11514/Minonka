import { ChampionPositions } from '$/lib/Assets';
import { SpectatorParticipantInput } from '$/types/worker/SpectatorParticipantInput';
import assert from 'node:assert';
import test from 'node:test';
import {
    orderSpectatorParticipants,
    scorePlayerRole,
    sortTeamParticipants
} from './spectatorOrder';

const mockChampionPositions: ChampionPositions = {
    '266': { id: 266, name: 'Aatrox', key: 'Aatrox', positions: ['TOP'] },
    '120': { id: 120, name: 'Hecarim', key: 'Hecarim', positions: ['JUNGLE'] },
    '103': { id: 103, name: 'Ahri', key: 'Ahri', positions: ['MIDDLE'] },
    '222': { id: 222, name: 'Jinx', key: 'Jinx', positions: ['BOTTOM'] },
    '412': { id: 412, name: 'Thresh', key: 'Thresh', positions: ['SUPPORT'] }
};

const createMockParticipant = (
    puuid: string,
    teamId: number,
    championId: number,
    spell1Id: number,
    spell2Id: number
): SpectatorParticipantInput => ({
    puuid,
    teamId,
    championId,
    spell1Id,
    spell2Id,
    riotId: `Player_${championId}#EUNE`,
    perks: {
        perkIds: [8112],
        perkStyle: 8100,
        perkSubStyle: 8000
    }
});

test('scorePlayerRole assigns high score to jungler with smite', () => {
    const jungler = createMockParticipant('p1', 100, 120, 6, 11); // Hecarim with Smite (11)
    const midLaner = createMockParticipant('p2', 100, 103, 4, 14); // Ahri with Flash/Ignite

    const jgScoreForJg = scorePlayerRole(jungler, 'JUNGLE', mockChampionPositions);
    const jgScoreForMid = scorePlayerRole(jungler, 'MIDDLE', mockChampionPositions);
    const midScoreForJg = scorePlayerRole(midLaner, 'JUNGLE', mockChampionPositions);
    const midScoreForMid = scorePlayerRole(midLaner, 'MIDDLE', mockChampionPositions);

    assert.ok(jgScoreForJg > 1000);
    assert.ok(jgScoreForMid < 0);
    assert.ok(midScoreForJg < 0);
    assert.ok(midScoreForMid > 50);
});

test('sortTeamParticipants orders a team as TOP, JUNGLE, MIDDLE, BOTTOM, SUPPORT', () => {
    // Intentionally pass players in random order
    const top = createMockParticipant('p_top', 100, 266, 4, 12); // Aatrox (Flash/TP)
    const jg = createMockParticipant('p_jg', 100, 120, 6, 11); // Hecarim (Ghost/Smite)
    const mid = createMockParticipant('p_mid', 100, 103, 4, 14); // Ahri (Flash/Ignite)
    const bot = createMockParticipant('p_bot', 100, 222, 4, 21); // Jinx (Flash/Barrier)
    const sup = createMockParticipant('p_sup', 100, 412, 4, 3); // Thresh (Flash/Exhaust)

    const randomTeam = [sup, top, bot, jg, mid];
    const sorted = sortTeamParticipants(randomTeam, mockChampionPositions);

    assert.strictEqual(sorted.length, 5);
    assert.strictEqual(sorted[0].championId, 266); // TOP (Aatrox)
    assert.strictEqual(sorted[1].championId, 120); // JUNGLE (Hecarim)
    assert.strictEqual(sorted[2].championId, 103); // MIDDLE (Ahri)
    assert.strictEqual(sorted[3].championId, 222); // BOTTOM (Jinx)
    assert.strictEqual(sorted[4].championId, 412); // SUPPORT (Thresh)
});

test('orderSpectatorParticipants does not sort on non-SR maps', async () => {
    const p1 = createMockParticipant('p1', 100, 412, 4, 3);
    const p2 = createMockParticipant('p2', 100, 266, 4, 12);

    // Map 12 is Howling Abyss (ARAM)
    const result = await orderSpectatorParticipants([p1, p2], 12);
    assert.strictEqual(result[0].championId, 412);
    assert.strictEqual(result[1].championId, 266);
});

test('orderSpectatorParticipants orders both teams on map 11 (Summoner Rift)', async () => {
    // Team 100
    const t1_sup = createMockParticipant('t1_sup', 100, 412, 4, 3);
    const t1_top = createMockParticipant('t1_top', 100, 266, 4, 12);
    const t1_bot = createMockParticipant('t1_bot', 100, 222, 4, 21);
    const t1_jg = createMockParticipant('t1_jg', 100, 120, 6, 11);
    const t1_mid = createMockParticipant('t1_mid', 100, 103, 4, 14);

    // Team 200
    const t2_mid = createMockParticipant('t2_mid', 200, 103, 4, 14);
    const t2_bot = createMockParticipant('t2_bot', 200, 222, 4, 21);
    const t2_top = createMockParticipant('t2_top', 200, 266, 4, 12);
    const t2_sup = createMockParticipant('t2_sup', 200, 412, 4, 3);
    const t2_jg = createMockParticipant('t2_jg', 200, 120, 6, 11);

    const participants = [
        t1_sup,
        t1_top,
        t1_bot,
        t1_jg,
        t1_mid,
        t2_mid,
        t2_bot,
        t2_top,
        t2_sup,
        t2_jg
    ];
    const ordered = await orderSpectatorParticipants(participants, 11);

    assert.strictEqual(ordered.length, 10);

    // Team 100 should be ordered: TOP, JUNGLE, MID, BOT, SUP
    assert.strictEqual(ordered[0].puuid, 't1_top');
    assert.strictEqual(ordered[1].puuid, 't1_jg');
    assert.strictEqual(ordered[2].puuid, 't1_mid');
    assert.strictEqual(ordered[3].puuid, 't1_bot');
    assert.strictEqual(ordered[4].puuid, 't1_sup');

    // Team 200 should be ordered: TOP, JUNGLE, MID, BOT, SUP
    assert.strictEqual(ordered[5].puuid, 't2_top');
    assert.strictEqual(ordered[6].puuid, 't2_jg');
    assert.strictEqual(ordered[7].puuid, 't2_mid');
    assert.strictEqual(ordered[8].puuid, 't2_bot');
    assert.strictEqual(ordered[9].puuid, 't2_sup');
});
