import { batchPromises, Cron } from '$/lib/cron';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { toValidResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { conn } from '$/types/connection';

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
                .selectFrom('lp')
                .select(['account_id', 'LP', 'queue', 'rank', 'tier', 'time'])
                .where((eb) =>
                    eb.and([
                        eb('account_id', '=', user.id),
                        eb(
                            'time',
                            '=',
                            eb
                                .selectFrom('lp as sub')
                                .select('time')
                                .whereRef('sub.account_id', '=', eb.ref('lp.account_id'))
                                .whereRef('sub.queue', '=', eb.ref('lp.queue'))
                                .orderBy('sub.time', 'desc')
                                .limit(1)
                        )
                    ])
                )
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

                    await conn
                        .insertInto('lp')
                        .values({
                            account_id: user.id,
                            queue: league.queueType,
                            rank: league.rank,
                            tier: league.tier,
                            LP: league.leaguePoints
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
