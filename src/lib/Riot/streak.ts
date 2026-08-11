import api from './api';
import { Region } from './types';

export type StreakData = {
    type: 'win' | 'loss';
    count: number;
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

        if (!matchesRes.status || matchesRes.data.length === 0) {
            return null;
        }

        const matchPromises = matchesRes.data.map((id) => api[region].match.match(id));
        const matches = await Promise.all(matchPromises);

        let streakType: 'win' | 'loss' | null = null;
        let count = 0;

        for (const matchRes of matches) {
            if (!matchRes.status) break;
            const participant = matchRes.data.info.participants.find(
                (p) => p.puuid === puuid
            );
            if (!participant) break;

            const isWin = participant.win;
            const currentType: 'win' | 'loss' = isWin ? 'win' : 'loss';

            if (streakType === null) {
                streakType = currentType;
                count = 1;
            } else if (streakType === currentType) {
                count++;
            } else {
                break;
            }
        }

        if (count >= 3 && streakType !== null) {
            return { type: streakType, count };
        }

        return null;
    } catch {
        return null;
    }
};
