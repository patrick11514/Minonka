import api from './api';
import { Region } from './types';

export type StreakData = {
    type: 'win' | 'loss';
    count: number;
};

// Map storing `${region}:${matchId}:${puuid}` -> boolean (isWin)
const matchParticipantOutcomeCache = new Map<string, boolean>();
const MAX_CACHE_SIZE = 1000;

export const clearStreakCache = () => {
    matchParticipantOutcomeCache.clear();
};

export const getCachedMatchOutcome = (
    region: Region,
    matchId: string,
    puuid: string
): boolean | undefined => {
    return matchParticipantOutcomeCache.get(`${region}:${matchId}:${puuid}`);
};

export const setCachedMatchOutcome = (
    region: Region,
    matchId: string,
    puuid: string,
    win: boolean
): void => {
    if (matchParticipantOutcomeCache.size >= MAX_CACHE_SIZE) {
        // delete oldest 200 entries to make space
        const it = matchParticipantOutcomeCache.keys();
        for (let i = 0; i < 200; i++) {
            const next = it.next();
            if (next.done) break;
            matchParticipantOutcomeCache.delete(next.value);
        }
    }
    matchParticipantOutcomeCache.set(`${region}:${matchId}:${puuid}`, win);
};

const fetchMatchOutcome = async (
    puuid: string,
    region: Region,
    matchId: string
): Promise<boolean | null> => {
    const cached = getCachedMatchOutcome(region, matchId, puuid);
    if (cached !== undefined) {
        return cached;
    }

    try {
        const matchRes = await api[region].match.match(matchId);
        if (!matchRes.status) return null;

        let userWin: boolean | null = null;
        for (const p of matchRes.data.info.participants) {
            setCachedMatchOutcome(region, matchId, p.puuid, p.win);
            if (p.puuid === puuid) {
                userWin = p.win;
            }
        }

        return userWin;
    } catch {
        return null;
    }
};

/**
 * Calculates current active win or loss streak for a given player queue.
 * Returns StreakData if streak count >= 3, else null.
 */
export const getRecentStreakForQueue = async (
    puuid: string,
    region: Region,
    queueId?: number
): Promise<StreakData | null> => {
    try {
        const matchesRes = await api[region].match.ids(puuid, {
            start: 0,
            count: 15,
            queue: queueId ? queueId.toString() : undefined
        });

        if (!matchesRes.status || matchesRes.data.length < 3) {
            return null;
        }

        const matchIds = matchesRes.data;

        // Fetch initial 3 matches in parallel
        const initialOutcomes = await Promise.all([
            fetchMatchOutcome(puuid, region, matchIds[0]),
            fetchMatchOutcome(puuid, region, matchIds[1]),
            fetchMatchOutcome(puuid, region, matchIds[2])
        ]);

        if (
            initialOutcomes[0] === null ||
            initialOutcomes[1] === null ||
            initialOutcomes[2] === null ||
            initialOutcomes[0] !== initialOutcomes[1] ||
            initialOutcomes[1] !== initialOutcomes[2]
        ) {
            // Either failed to fetch or streak broken before 3 matches
            return null;
        }

        const streakType: 'win' | 'loss' = initialOutcomes[0] ? 'win' : 'loss';
        let count = 3;

        // Continue fetching in chunks of 3 until streak breaks or no more matches
        for (let i = 3; i < matchIds.length; i += 3) {
            const chunk = matchIds.slice(i, i + 3);
            const chunkOutcomes = await Promise.all(
                chunk.map((id) => fetchMatchOutcome(puuid, region, id))
            );

            let broke = false;
            for (const outcome of chunkOutcomes) {
                if (outcome === null) {
                    broke = true;
                    break;
                }
                const outcomeType = outcome ? 'win' : 'loss';
                if (outcomeType === streakType) {
                    count++;
                } else {
                    broke = true;
                    break;
                }
            }

            if (broke) break;
        }

        return { type: streakType, count };
    } catch {
        return null;
    }
};
