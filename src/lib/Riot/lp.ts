import { updateLpForUser } from '$/crons/lp';
import { conn } from '$/types/connection';
import { _Rank, _Tier, Rank, Region } from './types';

export type LpDetails = {
    gain: number | null;
    tierChange?: {
        isPromotion: boolean;
        tier: _Tier;
        rank?: _Rank;
    };
};

export async function getLpDetails(
    matchId: string,
    queue: number,
    puuid: string,
    region: Region
): Promise<LpDetails> {
    if (queue !== 420 && queue !== 440) return { gain: null }; // Only ranked games

    const account = await conn
        .selectFrom('account')
        .selectAll()
        .where('puuid', '=', puuid)
        .executeTakeFirst();

    if (!account) return { gain: null };

    // Retry up to 2 times so that we query match_lp again after running updateLpForUser
    for (let i = 0; i < 2; ++i) {
        const matchLpRecord = await conn
            .selectFrom('match_lp')
            .selectAll()
            .where((eb) =>
                eb.and([eb('matchId', '=', matchId), eb('accountId', '=', account.id)])
            )
            .executeTakeFirst();

        if (matchLpRecord) {
            const currentLpRecord = await conn
                .selectFrom('lp')
                .selectAll()
                .where('id', '=', matchLpRecord.lp)
                .executeTakeFirst();

            if (!currentLpRecord) {
                return { gain: matchLpRecord.gain };
            }

            // Find the LP record immediately preceding this one to detect rank/tier boundary crossing
            const previousLpRecord = await conn
                .selectFrom('lp')
                .selectAll()
                .where((eb) =>
                    eb.and([
                        eb('account_id', '=', account.id),
                        eb('queue', '=', currentLpRecord.queue),
                        eb('id', '<', currentLpRecord.id)
                    ])
                )
                .orderBy('id', 'desc')
                .executeTakeFirst();

            if (!previousLpRecord) {
                return { gain: matchLpRecord.gain };
            }

            const currentRank = new Rank({
                tier: currentLpRecord.tier as _Tier,
                rank: currentLpRecord.rank as _Rank,
                leaguePoints: currentLpRecord.LP
            });

            const previousRank = new Rank({
                tier: previousLpRecord.tier as _Tier,
                rank: previousLpRecord.rank as _Rank,
                leaguePoints: previousLpRecord.LP
            });

            let tierChange: LpDetails['tierChange'];
            const currentTotal = currentRank.getTotalLp();
            const previousTotal = previousRank.getTotalLp();

            if (
                currentLpRecord.tier !== previousLpRecord.tier ||
                currentLpRecord.rank !== previousLpRecord.rank
            ) {
                const isPromotion = currentTotal > previousTotal;
                const tier = currentLpRecord.tier as _Tier;
                const rankVal = currentLpRecord.rank as _Rank;

                tierChange = {
                    isPromotion,
                    tier,
                    rank: rankVal
                };
            }

            return {
                gain: matchLpRecord.gain,
                tierChange
            };
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

    return { gain: null };
}

export async function getLpGain(
    matchId: string,
    queue: number,
    puuid: string,
    region: Region
): Promise<number | null> {
    const details = await getLpDetails(matchId, queue, puuid, region);
    return details.gain;
}
