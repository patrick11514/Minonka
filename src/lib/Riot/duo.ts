import { MatchSchema } from '$/lib/Riot/schemes';
import { conn } from '$/types/connection';
import type { z } from 'zod';

type MatchData = z.infer<typeof MatchSchema>;

/**
 * Saves participant stats and same-team duo pairs into the database.
 */
export const recordMatchDataAndDuoPairs = async (match: MatchData) => {
    try {
        const matchId = match.metadata.matchId;
        const queueId = match.info.queueId;
        const participants = match.info.participants;

        if (!participants || participants.length === 0) return;

        // Fetch accounts from DB to map puuid -> account_id if available
        const puuids = participants.map((p) => p.puuid);
        const registeredAccounts = await conn
            .selectFrom('account')
            .select(['id', 'puuid'])
            .where('puuid', 'in', puuids)
            .execute();

        const accountMap = new Map<string, number>();
        for (const acc of registeredAccounts) {
            accountMap.set(acc.puuid, acc.id);
        }

        // Insert participant stats
        const statValues = participants.map((p) => ({
            match_id: matchId,
            puuid: p.puuid,
            account_id: accountMap.get(p.puuid) ?? null,
            queue_id: queueId,
            win: p.win,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            champion_id: p.championId,
            damage_dealt: p.totalDamageDealtToChampions,
            damage_taken: p.totalDamageTaken,
            vision_score: p.visionScore,
            wards_placed: p.wardsPlaced,
            wards_killed: p.wardsKilled,
            gold_earned: p.goldEarned,
            minions_killed: p.totalMinionsKilled
        }));

        await conn
            .insertInto('match_participant_stat')
            .values(statValues)
            .onConflict((oc) => oc.columns(['match_id', 'puuid']).doNothing())
            .execute();

        // Record duo pairs for participants playing on the SAME team
        const teamMap = new Map<number, string[]>();
        for (const p of participants) {
            const team = teamMap.get(p.teamId) ?? [];
            team.push(p.puuid);
            teamMap.set(p.teamId, team);
        }

        const duoPairs: { puuid1: string; puuid2: string; match_id: string }[] = [];
        for (const teamPuuids of teamMap.values()) {
            for (let i = 0; i < teamPuuids.length; i++) {
                for (let j = i + 1; j < teamPuuids.length; j++) {
                    const [puuid1, puuid2] =
                        teamPuuids[i] < teamPuuids[j]
                            ? [teamPuuids[i], teamPuuids[j]]
                            : [teamPuuids[j], teamPuuids[i]];
                    duoPairs.push({ puuid1, puuid2, match_id: matchId });
                }
            }
        }

        if (duoPairs.length > 0) {
            await conn
                .insertInto('duo_match')
                .values(duoPairs)
                .onConflict((oc) =>
                    oc.columns(['puuid1', 'puuid2', 'match_id']).doNothing()
                )
                .execute();
        }
    } catch {
        // Silent error logging to avoid breaking main command flow
    }
};

/**
 * Analyzes team relationships in a match and returns a Map of puuid -> team_number (1-indexed).
 * Players on the SAME team with > 5 shared games recorded will receive a matching team number.
 */
export const getMatchTeamIndicators = async (
    match: MatchData
): Promise<Record<string, number>> => {
    const result: Record<string, number> = {};
    const participants = match.info.participants;
    if (!participants || participants.length === 0) return result;

    const teamMap = new Map<number, string[]>();
    for (const p of participants) {
        const team = teamMap.get(p.teamId) ?? [];
        team.push(p.puuid);
        teamMap.set(p.teamId, team);
    }

    let currentTeamIndex = 1;

    for (const teamPuuids of teamMap.values()) {
        const pairs: { p1: string; p2: string }[] = [];
        for (let i = 0; i < teamPuuids.length; i++) {
            for (let j = i + 1; j < teamPuuids.length; j++) {
                const [p1, p2] =
                    teamPuuids[i] < teamPuuids[j]
                        ? [teamPuuids[i], teamPuuids[j]]
                        : [teamPuuids[j], teamPuuids[i]];
                pairs.push({ p1, p2 });
            }
        }

        if (pairs.length === 0) continue;

        // Query database for shared games count for these pairs
        const dbCounts = await conn
            .selectFrom('duo_match')
            .select(['puuid1', 'puuid2'])
            .select((eb) => eb.fn.count<number>('id').as('count'))
            .where((eb) =>
                eb.or(
                    pairs.map((pair) =>
                        eb.and([eb('puuid1', '=', pair.p1), eb('puuid2', '=', pair.p2)])
                    )
                )
            )
            .groupBy(['puuid1', 'puuid2'])
            .execute();

        const qualifiedPairs = new Set<string>();
        for (const row of dbCounts) {
            if (Number(row.count) > 5) {
                qualifiedPairs.add(`${row.puuid1}:${row.puuid2}`);
            }
        }

        // Build connected components for players with qualified duo connections
        const playerTeams = new Map<string, Set<string>>();
        for (const pair of pairs) {
            if (qualifiedPairs.has(`${pair.p1}:${pair.p2}`)) {
                if (!playerTeams.has(pair.p1))
                    playerTeams.set(pair.p1, new Set([pair.p1]));
                if (!playerTeams.has(pair.p2))
                    playerTeams.set(pair.p2, new Set([pair.p2]));

                const set1 = playerTeams.get(pair.p1)!;
                const set2 = playerTeams.get(pair.p2)!;
                if (set1 !== set2) {
                    for (const elem of set2) {
                        set1.add(elem);
                        playerTeams.set(elem, set1);
                    }
                }
            }
        }

        const visited = new Set<string>();
        for (const p of teamPuuids) {
            if (visited.has(p)) continue;
            const group = playerTeams.get(p);
            if (group && group.size > 1) {
                for (const member of group) {
                    visited.add(member);
                    result[member] = currentTeamIndex;
                }
                currentTeamIndex++;
            }
        }
    }

    return result;
};
