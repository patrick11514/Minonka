import { z } from 'zod';
import { ApiSet } from './apiSet';
import { Region, regions } from './types';
import RiotAPI from './riotApi';
import { AccountSchema, ChallengeSchema, MatchSchema, SummonerSchema } from './schemes';

const BASE_ROUTING_URL = 'https://EUROPE.api.riotgames.com';
const getBaseURL = (region: Region) => {
    return `https://${region}.api.riotgames.com`;
};

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
            schema: ChallengeSchema
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
    }),
    match: new ApiSet('/lol/match/v5', {
        ids: (
            puuid: string,
            query: Partial<{
                startTime: number;
                endTime: number;
                queue: string;
                type: 'ranked' | 'normal' | 'tourney' | 'tutorial';
                start: number;
                count: number;
            }>
        ) => ({
            regional: false,
            endOfUrl: `/matches/by-puuid/${puuid}/ids?${new URLSearchParams({
                start: '0',
                count: '20',
                ...Object.fromEntries(
                    Object.entries(query)
                        .filter(([, value]) => value !== undefined && value !== null)
                        .map(([key, value]) => [key, value.toString()])
                )
            }).toString()}`,
            schema: z.array(z.string())
        }),
        match: (matchId: string) => ({
            regional: false,
            endOfUrl: `/matches/${matchId}`,
            schema: MatchSchema
        })
    })
};

const createForRegion = (region: Region) =>
    RiotAPI(RiotAPIStructure, getBaseURL(region), BASE_ROUTING_URL);

export default Object.fromEntries(
    regions.map((region) => [region, createForRegion(region)])
) as Record<Region, ReturnType<typeof createForRegion>>;
