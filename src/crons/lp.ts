import { batchPromises, Cron } from '$/lib/cron';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { toValidResponse } from '$/lib/Riot/baseRequest';
import { Rank, Region } from '$/lib/Riot/types';
import { conn } from '$/types/connection';
import { sql } from 'kysely';

const l = new Logger('LP', 'magenta');

export default [
    '0 */10 * * * *',
    async () => {
        l.start('Updating LPs...');

        const users = await conn.selectFrom('account').selectAll().execute();

        const leagueResponses = await batchPromises(
            users.map((user) => async () => {
                return api[user.region as Region].league.bySummonerId(user.summoner_id);
            }),
            10,
            1000
        );

        const validLeagueResponses = leagueResponses.filter(
            (l) => l.status
        ) as toValidResponse<(typeof leagueResponses)[number]>[];

        for (const idx in validLeagueResponses) {
            const leagues = validLeagueResponses[idx];
            const user = users[idx];

            const recentQueues = await conn
                .with('Ranked', (db) =>
                    db
                        .selectFrom('lp')
                        .selectAll()
                        .select(() =>
                            sql<number>`ROW_NUMBER() OVER(PARTITION BY account_id, queue ORDER BY time DESC)`.as(
                                'rn'
                            )
                        )
                        .where('account_id', '=', user.id)
                )
                .selectFrom('Ranked')
                .select(['id', 'account_id', 'LP', 'queue', 'rank', 'tier', 'time'])
                .where('rn', '=', 1)
                .execute();

            try {
                for (const league of leagues.data) {
                    const exists = recentQueues.find(
                        (lp) => lp.queue === league.queueType
                    );
                    let insert = false;

                    if (!exists) {
                        insert = true;
                    } else if (
                        exists.rank !== league.rank ||
                        exists.tier !== league.tier ||
                        exists.LP !== league.leaguePoints
                    ) {
                        insert = true;
                    }

                    if (!insert) continue;

                    const insertData = await conn
                        .insertInto('lp')
                        .values({
                            account_id: user.id,
                            queue: league.queueType,
                            rank: league.rank,
                            tier: league.tier,
                            LP: league.leaguePoints
                        })
                        .executeTakeFirst();

                    if (insertData.insertId === undefined) continue;
                    //also check for new matches and match them wit
                    const matches = await api[user.region as Region].match.ids(
                        user.puuid,
                        {
                            count: 2,
                            start: 0,
                            queue: league.queueType === 'RANKED_SOLO_5x5' ? '420' : '440'
                        }
                    );
                    if (!matches.status) continue;

                    //select coresponding matches from db
                    const matchesLp = await conn
                        .selectFrom('match_lp')
                        .innerJoin('lp', 'lp.id', 'match_lp.lp')
                        .selectAll()
                        .where('matchId', 'in', matches.data)
                        .execute();

                    if (matchesLp.length === 2) continue; //all matches have match in db
                    if (matchesLp.length === 0) {
                        //no matches in db, so connect last one with currentLp
                        await conn
                            .insertInto('match_lp')
                            .values({
                                matchId: matches.data[0],
                                lp: Number(insertData.insertId)
                            })
                            .execute();
                        continue;
                    }

                    //if one match is in db, connect other one
                    //try if the newest one is not the connected
                    //and if yes, skip it
                    if (matchesLp[0].matchId === matches.data[0]) continue;
                    await conn
                        .insertInto('match_lp')
                        .values({
                            matchId: matches.data[0],
                            lp: Number(insertData.insertId),
                            //newest lp - older lp
                            gain:
                                new Rank(league).getTotalLp() -
                                new Rank({
                                    rank: matchesLp[0].rank,
                                    tier: matchesLp[0].tier,
                                    leaguePoints: matchesLp[0].LP
                                }).getTotalLp()
                        })
                        .execute();
                }
            } catch (e) {
                l.error(`Failed to update LPs for ${user.gameName}#${user.tagLine}`);
                l.error(e);
            }
        }

        l.stop('LPs update completed');
    }
] satisfies Cron;
