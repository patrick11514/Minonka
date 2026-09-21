import { ChampionPositions, getChampionPositions, Position } from '$/lib/Assets';
import { SpectatorParticipantInput } from '$/types/worker/SpectatorParticipantInput';

export const ROLE_ORDER: Position[] = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'];

export const SMITE_SPELL_IDS = new Set([11, 711]); // SummonerSmite
export const TP_SPELL_IDS = new Set([12, 712]); // Teleport
export const HEAL_BARRIER_SPELL_IDS = new Set([7, 21, 77, 721]); // Heal, Barrier
export const EXHAUST_SPELL_IDS = new Set([3, 73]); // Exhaust
export const IGNITE_SPELL_IDS = new Set([14, 714]); // Ignite

export function scorePlayerRole(
    player: SpectatorParticipantInput,
    role: Position,
    championPositions?: ChampionPositions | null
): number {
    let score = 0;
    const spells = [player.spell1Id, player.spell2Id];
    const hasSmite = spells.some((id) => SMITE_SPELL_IDS.has(id));
    const hasTp = spells.some((id) => TP_SPELL_IDS.has(id));
    const hasHealOrBarrier = spells.some((id) => HEAL_BARRIER_SPELL_IDS.has(id));
    const hasExhaust = spells.some((id) => EXHAUST_SPELL_IDS.has(id));
    const hasIgnite = spells.some((id) => IGNITE_SPELL_IDS.has(id));

    // 1. Smite logic: jungle has highest priority
    if (role === 'JUNGLE') {
        if (hasSmite) {
            score += 1000;
        } else {
            score -= 500;
        }
    } else {
        if (hasSmite) {
            score -= 1000;
        }
    }

    // 2. Champion typical positions
    const champInfo = championPositions?.[player.championId.toString()];
    const positions = champInfo?.positions ?? [];
    if (positions.includes(role)) {
        const idx = positions.indexOf(role);
        score += 100 - idx * 30; // Primary: 100, Secondary: 70, Tertiary: 40...
    } else if (positions.length > 0) {
        score -= 50;
    }

    // 3. Summoner spell heuristics
    if (hasTp) {
        if (role === 'TOP') score += 25;
        else if (role === 'MIDDLE') score += 10;
        else if (role === 'BOTTOM' || role === 'SUPPORT') score -= 30;
    }

    if (hasHealOrBarrier) {
        if (role === 'BOTTOM') score += 25;
    }

    if (hasExhaust) {
        if (role === 'SUPPORT') score += 25;
    }

    if (hasIgnite) {
        if (role === 'SUPPORT') score += 15;
        else if (role === 'MIDDLE') score += 10;
        else if (role === 'TOP') score += 10;
        else if (role === 'BOTTOM') score -= 20;
    }

    return score;
}

function getArrangements(available: number[], k: number): number[][] {
    if (k === 0) return [[]];
    const result: number[][] = [];
    for (let i = 0; i < available.length; i++) {
        const item = available[i];
        const rest = [...available.slice(0, i), ...available.slice(i + 1)];
        const sub = getArrangements(rest, k - 1);
        for (const s of sub) {
            result.push([item, ...s]);
        }
    }
    return result;
}

export function sortTeamParticipants(
    team: SpectatorParticipantInput[],
    championPositions?: ChampionPositions | null
): SpectatorParticipantInput[] {
    if (team.length <= 1) {
        return team;
    }

    const count = Math.min(team.length, ROLE_ORDER.length);
    const availableRoleIndices = [0, 1, 2, 3, 4];
    const arrangements = getArrangements(availableRoleIndices, count);

    let bestArrangement: number[] = [];
    let bestScore = -Infinity;

    for (const arr of arrangements) {
        let totalScore = 0;
        for (let i = 0; i < count; i++) {
            const role = ROLE_ORDER[arr[i]];
            totalScore += scorePlayerRole(team[i], role, championPositions);
        }

        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestArrangement = arr;
        }
    }

    const assigned = team.slice(0, count).map((player, i) => ({
        player,
        roleIndex: bestArrangement[i]
    }));

    assigned.sort((a, b) => a.roleIndex - b.roleIndex);

    const sortedPlayers = assigned.map((a) => a.player);

    if (team.length > count) {
        sortedPlayers.push(...team.slice(count));
    }

    return sortedPlayers;
}

export async function orderSpectatorParticipants(
    participants: SpectatorParticipantInput[],
    mapId: number
): Promise<SpectatorParticipantInput[]> {
    // Only sort for Summoner's Rift (mapId 11)
    if (mapId !== 11) {
        return participants;
    }

    const championPositions = await getChampionPositions();

    const teams = new Map<number, SpectatorParticipantInput[]>();
    for (const p of participants) {
        const list = teams.get(p.teamId) ?? [];
        list.push(p);
        teams.set(p.teamId, list);
    }

    // Sort teams so team 100 (blue) comes first, then 200 (red)
    const teamIds = Array.from(teams.keys()).sort((a, b) => {
        if (a === 100) return -1;
        if (b === 100) return 1;
        return a - b;
    });

    const result: SpectatorParticipantInput[] = [];
    for (const teamId of teamIds) {
        const teamParticipants = teams.get(teamId)!;
        const sorted = sortTeamParticipants(teamParticipants, championPositions);
        result.push(...sorted);
    }

    return result;
}
