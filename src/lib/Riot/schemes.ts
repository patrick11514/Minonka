import { z } from 'zod';
import { Position, positions } from './types';

export const AccountSchema = z.object({
    puuid: z.string(),
    gameName: z.string(),
    tagLine: z.string()
});

export const SummonerSchema = z.object({
    profileIconId: z.number(),
    revisionDate: z.number(),
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

export const ParticipantSchema = z.object({
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
    ...Object.fromEntries(
        Array.from({ length: 7 }).map((_, id) => [
            `item${id}` as NumberSuffix<'item', 0 | 1 | 2 | 3 | 4 | 5 | 6>,
            z.number()
        ])
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
    puuid: z.string()
});

const cherryParticipantSchema = ParticipantSchema.extend({
    playerSubteamId: z.number(),
    subteamPlacement: z.number(),
    ...Object.fromEntries(
        Array.from({ length: 6 }).map((_, id) => [
            `playerAugment${id + 1}` as NumberSuffix<
                'playerAugment',
                1 | 2 | 3 | 4 | 5 | 6
            >,
            id > 3 ? z.number().optional() : z.number()
        ])
    )
});

export const RegularMatchSchema = z.object({
    metadata: z.object({
        dataVersion: z.string(),
        matchId: z.string(),
        participants: z.array(z.string())
    }),
    info: z.object({
        gameCreation: z.number(),
        gameDuration: z.number(),
        gameStartTimestamp: z.number(),
        gameEndTimestamp: z.number(),
        gameId: z.number(),
        gameMode: z.string(),
        gameName: z.string(),
        mapId: z.number(),
        participants: z.array(ParticipantSchema),
        queueId: z.number(),
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

export const CherryMatchSchema = RegularMatchSchema.extend({
    info: RegularMatchSchema.shape.info.extend({
        participants: z.array(cherryParticipantSchema),
        teams: z.array(
            RegularMatchSchema.shape.info.shape.teams.element.extend({
                /* in cherry games, all players are in same team, so second team have just id 0*/
                teamId: RegularMatchSchema.shape.info.shape.teams.element.shape.teamId.or(
                    z.literal(0)
                )
            })
        )
    })
});

export const MatchSchema = z.union([RegularMatchSchema, CherryMatchSchema]);

export const ClashMemberSchema = z.object({
    puuid: z.string(),
    position: z.string().refine((v): v is Position => positions.includes(v as Position)),
    role: z.literal('CAPTAIN').or(z.literal('MEMBER'))
});

export const MasterySchema = z.object({
    puuid: z.string(),
    championId: z.number(),
    championLevel: z.number(),
    championPoints: z.number(),
    lastPlayTime: z.number()
});

export const SpectatorSchema = z.object({
    gameId: z.number(),
    mapId: z.number(),
    gameMode: z.string(),
    gameType: z.string(),
    gameQueueConfigId: z.number(),
    gameStartTime: z.number(),
    gameLength: z.number(),
    participants: z.array(
        z.object({
            puuid: z.string(),
            teamId: z.number(),
            spell1Id: z.number(),
            spell2Id: z.number(),
            championId: z.number(),
            profileIconId: z.number(),
            riotId: z.string(),
            bot: z.boolean(),
            gameCustomizationObjects: z.array(z.any()),
            perks: z.object({
                perkIds: z.array(z.number()),
                perkStyle: z.number(),
                perkSubStyle: z.number()
            })
        })
    ),
    platformId: z.string(),
    bannedChampions: z.array(
        z.object({
            championId: z.number(),
            teamId: z.number(),
            pickTurn: z.number()
        })
    )
});
