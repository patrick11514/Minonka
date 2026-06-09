import { updateLpForUser } from '$/crons/lp';
import { conn } from '$/types/connection';
import { Region } from './types';

export async function getLpGain(
    matchId: string,
    queue: number,
    puuid: string,
    region: Region
): Promise<number | null> {
    if (queue !== 420 && queue !== 440) return null; // Only ranked games

    const account = await conn
        .selectFrom('account')
        .selectAll()
        .where('puuid', '=', puuid)
        .executeTakeFirst();

    if (!account) return null;

    // Retry up to 2 times so that we query match_lp again after running updateLpForUser
    for (let i = 0; i < 2; ++i) {
        const lp = await conn
            .selectFrom('match_lp')
            .selectAll()
            .where((eb) =>
                eb.and([eb('matchId', '=', matchId), eb('accountId', '=', account.id)])
            )
            .executeTakeFirst();

        if (lp) {
            return lp.gain;
        }

        // Try to fetch LP if not found on the first iteration
        if (i === 0) {
            await updateLpForUser({
                puuid,
                region,
                gameName: account.gameName,
                tagLine: account.tagLine,
                id: account.id
            });
        }
    }

    return null;
}
