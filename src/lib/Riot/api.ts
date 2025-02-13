import { z } from 'zod';
import { ApiSet } from './apiSet';
import { Region, regions } from './types';
import RiotAPI from './riotApi';

const BASE_ROUTING_URL = 'https://EUROPE.api.riotgames.com';
const getBaseURL = (region: Region) => {
    return `https://${region}.api.riotgames.com`;
};

const AccountSchema = z.object({
    puuid: z.string(),
    gameName: z.string(),
    tagLine: z.string()
});

const SummonerSchema = z.object({
    accountId: z.string(),
    profileIconId: z.number(),
    revisionDate: z.number(),
    id: z.string(),
    puuid: z.string(),
    summonerLevel: z.number()
});

const ChallengeTier = z
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

const RiotAPIStructure = {
    account: new ApiSet('/riot/account/v1/accounts', {
        name: (gameName: string, tagLine: string) => ({
            regional: false,
            endOfUrl: `/by-riot-id/${gameName}/${tagLine}`,
            schema: AccountSchema
        }),
        byPuuid: (puuid: string) => ({
            regional: false,
            endOfUrl: `/by-puuid/${puuid}`,
            schema: AccountSchema
        })
    }),
    summoner: new ApiSet('/lol/summoner/v4/summoners', {
        byPuuid: (puuid: string) => ({
            regional: true,
            endOfUrl: `/by-puuid/${puuid}`,
            schema: SummonerSchema
        }),
        bySummonerId: (summonerId: string) => ({
            regional: true,
            endOfUrl: `/${summonerId}`,
            schema: SummonerSchema
        })
    }),
    challenges: new ApiSet('/lol/challenges/v1', {
        byPuuid: (puuid: string) => ({
            regional: true,
            endOfUrl: `/player-data/${puuid}`,
            schema: z.object({
                totalPoints: z.object({
                    level: ChallengeTier,
                    current: z.number(),
                    max: z.number(),
                    percentile: z.number()
                }),
                categoryPoints: z.record(
                    z.string(),
                    z.object({
                        level: ChallengeTier,
                        current: z.number(),
                        max: z.number(),
                        percentile: z.number()
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
                preferences: z.object({
                    bannerAccent: z.coerce.number(),
                    title: z.string(),
                    challengeIds: z.array(z.number()),
                    crestBorder: z.coerce.number(),
                    prestigeCrestBorderLevel: z.coerce.number()
                })
            })
        })
    }),
    league: new ApiSet('/lol/league/v4', {
        bySummonerId: (summonerId: string) => ({
            regional: true,
            endOfUrl: `/entries/by-summoner/${summonerId}`,
            schema: z.array(
                z.object({
                    leagueId: z.string(),
                    summonerId: z.string(),
                    queueType: z.string(),
                    tier: z.string(),
                    rank: z.string(),
                    leaguePoints: z.number(),
                    wins: z.number(),
                    losses: z.number(),
                    hotStreak: z.boolean(),
                    veteran: z.boolean(),
                    freshBlood: z.boolean(),
                    inactive: z.boolean()
                    /*miniSeries: z.optional(
                        z.record(z.string(), z.union([z.literal('W'), z.literal('L')]))
                    )*/ //placements, dont exists anymore in game
                })
            )
        })
    })
};

const createForRegion = (region: Region) =>
    RiotAPI(RiotAPIStructure, getBaseURL(region), BASE_ROUTING_URL);

export default Object.fromEntries(
    regions.map((region) => [region, createForRegion(region)])
) as Record<Region, ReturnType<typeof createForRegion>>;
