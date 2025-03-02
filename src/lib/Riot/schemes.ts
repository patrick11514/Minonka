import { z } from 'zod';
import { fromEntries } from '../utilities';
import { Position, positions, QueueId, queues } from './types';

export const AccountSchema = z.object({
    puuid: z.string(),
    gameName: z.string(),
    tagLine: z.string()
});

export const SummonerSchema = z.object({
    accountId: z.string(),
    profileIconId: z.number(),
    revisionDate: z.number(),
    id: z.string(),
    puuid: z.string(),
    summonerLevel: z.number()
});

export const ChallengeTier = z
    .literal('IRON')
    .or(z.literal('BRONZE'))
    .or(z.literal('SILVER'))
    .or(z.literal('GOLD'))
    .or(z.literal('PLATINUM'))
    .or(z.literal('DIAMOND'))
    .or(z.literal('MASTER'))
    .or(z.literal('GRANDMASTER'))
    .or(z.literal('CHALLENGER'))
    .or(z.literal('NONE'));

export const ChallengeSchema = z.object({
    totalPoints: z.object({
        level: ChallengeTier,
        current: z.number(),
        max: z.number(),
        percentile: z.number().optional()
    }),
    categoryPoints: z.record(
        z.string(),
        z.object({
            level: ChallengeTier,
            current: z.number(),
            max: z.number(),
            percentile: z.number().optional()
        })
    ),
    challenges: z.array(
        z.object({
            challengeId: z.number(),
            percentile: z.number(),
            level: ChallengeTier,
            value: z.number(),
            achievedTime: z.number().optional(),
            position: z.number().optional(),
            playersInLevel: z.number().optional()
        })
    ),
    preferences: z
        .object({
            bannerAccent: z.coerce.number(),
            title: z.string(),
            challengeIds: z.array(z.number()),
            crestBorder: z.coerce.number(),
            prestigeCrestBorderLevel: z.coerce.number()
        })
        .partial()
});

export type ChallengeData = z.infer<typeof ChallengeSchema>;

type NumberSuffix<$Prefix extends string, $Num extends number> = `${$Prefix}${$Num}`;

const ParticipantSchema = z.object({
    champExperience: z.number(),
    champLevel: z.number(),
    championId: z.number(),
    championName: z.string(),
    deaths: z.number(),
    doubleKills: z.number(),
    tripleKills: z.number(),
    quadraKills: z.number(),
    pentaKills: z.number(),
    dragonKills: z.number(),
    gameEndedInEarlySurrender: z.boolean(),
    gameEndedInSurrender: z.boolean(),
    goldEarned: z.number(),
    goldSpent: z.number(),
    individualPosition: z
        .literal('TOP')
        .or(z.literal('JUNGLE'))
        .or(z.literal('MIDDLE'))
        .or(z.literal('BOTTOM'))
        .or(z.literal('UTILITY'))
        .or(z.literal('Invalid')),
    //item
    ...fromEntries<NumberSuffix<'item', 0 | 1 | 2 | 3 | 4 | 5 | 6>, z.ZodNumber>(
        //eslint-disable-next-line @typescript-eslint/no-explicit-any
        Array.from({ length: 7 }).map((_, id) => [`item${id}`, z.number()]) as any
    ),
    kills: z.number(),
    assists: z.number(),
    lane: z
        .literal('TOP')
        .or(z.literal('JUNGLE'))
        .or(z.literal('MIDDLE'))
        .or(z.literal('BOTTOM'))
        .or(z.literal('UTILITY'))
        .or(z.literal('NONE')),
    largestMultiKill: z.number(),
    neutralMinionsKilled: z.number(),
    perks: z.object({
        statPerks: z.object({
            defense: z.number(),
            flex: z.number(),
            offense: z.number()
        }),
        styles: z.array(
            z.object({
                description: z.literal('primaryStyle').or(z.literal('subStyle')),
                selections: z.array(
                    z.object({
                        perk: z.number(),
                        var1: z.number(),
                        var2: z.number(),
                        var3: z.number()
                    })
                ),
                style: z.number()
            })
        )
    }),
    riotIdGameName: z.string(),
    riotIdTagline: z.string(),
    role: z
        .literal('DUO')
        .or(z.literal('NONE'))
        .or(z.literal('SOLO'))
        .or(z.literal('CARRY'))
        .or(z.literal('SUPPORT')),
    summoner1Id: z.number(),
    summoner2Id: z.number(),
    teamEarlySurrendered: z.boolean(),
    teamId: z.literal(100).or(z.literal(200)),
    teamPosition: z
        .literal('TOP')
        .or(z.literal('JUNGLE'))
        .or(z.literal('MIDDLE'))
        .or(z.literal('BOTTOM'))
        .or(z.literal('UTILITY'))
        .or(z.literal('')),
    totalDamageDealt: z.number(),
    totalMinionsKilled: z.number(),
    visionScore: z.number(),
    win: z.boolean(),
    summonerId: z.string(),
    puuid: z.string()
});

const queueIds = queues.map((queue) => queue.queueId);

export const MatchSchema = z.object({
    metadata: z.object({
        dataVersion: z.string(),
        matchId: z.string(),
        participants: z.array(z.string())
    }),
    info: z.object({
        endOfGameResult: z.string(),
        gameCreation: z.number(),
        gameDuration: z.number(),
        gameStartTimestamp: z.number(),
        gameEndTimestamp: z.number(),
        gameId: z.number(),
        gameMode: z.string(),
        gameName: z.string(),
        mapId: z.number(),
        participants: z.array(ParticipantSchema),
        queueId: z.number().refine((v): v is QueueId => queueIds.includes(v as QueueId)),
        teams: z.array(
            z.object({
                bans: z.array(
                    z.object({
                        championId: z.number(),
                        pickTurn: z.number()
                    })
                ),
                feats: z
                    .record(
                        z.union([
                            z.literal('EPIC_MONSTER_KILL'),
                            z.literal('FIRST_BLOOD'),
                            z.literal('FIRST_TURRET')
                        ]),
                        z.object({
                            featState: z.number()
                        })
                    )
                    .optional(),
                objectives: z.record(
                    z.union([
                        z.literal('atakhan'),
                        z.literal('baron'),
                        z.literal('champion'),
                        z.literal('dragon'),
                        z.literal('horde'),
                        z.literal('inhibitor'),
                        z.literal('riftHerald'),
                        z.literal('tower')
                    ]),
                    z.object({
                        first: z.boolean(),
                        kills: z.number()
                    })
                ),
                teamId: z.literal(100).or(z.literal(200)),
                win: z.boolean()
            })
        )
    })
});

export const ClashMemberSchema = z.object({
    summonerId: z.string(),
    puuid: z.string(),
    position: z.string().refine((v): v is Position => positions.includes(v as Position)),
    role: z.literal('CAPTAIN').or(z.literal('MEMBER'))
});
