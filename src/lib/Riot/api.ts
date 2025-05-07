import { z } from 'zod';
import { ApiSet } from './apiSet';
import { Region, regions } from './types';
import RiotAPI from './riotApi';
import {
    AccountSchema,
    ChallengeSchema,
    ClashMemberSchema,
    MatchSchema,
    SummonerSchema,
    MasterySchema
} from './schemes';

const getBaseRoutingURL = (region: Region) => {
    let prefix = '';
    switch (region) {
        case 'EUN1':
        case 'EUW1':
        case 'ME1':
        case 'TR1':
        case 'RU':
            prefix = 'EUROPE';
            break;
        case 'NA1':
        case 'BR1':
        case 'LA1':
        case 'LA2':
            prefix = 'AMERICAS';
            break;
        case 'KR':
        case 'JP1':
            prefix = 'ASIA';
            break;
        case 'OC1':
        case 'SG2':
        case 'TW2':
        case 'VN2':
            prefix = 'SEA';
            break;
    }

    return `https://${prefix}.api.riotgames.com`;
};

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
                ...{
                    start: '0',
                    count: '20'
                },
                ...Object.fromEntries(
                    Object.entries(query)
                        .filter((value) => value !== undefined)
                        .filter(([, value]) => value !== undefined && value !== null)
                        .map(([key, value]) => [key, (value ?? '').toString()])
                )
            }).toString()}`,
            schema: z.array(z.string())
        }),
        match: (matchId: string) => ({
            regional: false,
            endOfUrl: `/ matches / ${matchId} `,
            schema: MatchSchema
        })
    }),
    clash: new ApiSet('/lol/clash/v1', {
        tournaments: () => ({
            regional: true,
            endOfUrl: '/tournaments',
            schema: z.array(
                z.object({
                    id: z.number(),
                    themeId: z.number(),
                    nameKey: z.string(),
                    nameKeySecondary: z.string(),
                    schedule: z.array(
                        z.object({
                            id: z.number(),
                            registrationTime: z.number(),
                            startTime: z.number(),
                            cancelled: z.boolean()
                        })
                    )
                })
            )
        }),
        players: (puuid: string) => ({
            regional: true,
            endOfUrl: `/ players / by - puuid / ${puuid} `,
            schema: z.array(
                ClashMemberSchema.extend({
                    teamId: z.string()
                })
            )
        }),
        team: (teamId: string) => ({
            regional: true,
            endOfUrl: `/ teams / ${teamId} `,
            schema: z.object({
                id: z.string(),
                tournamentId: z.number(),
                name: z.string(),
                abbreviation: z.string(),
                iconId: z.number(),
                tier: z.number(),
                captain: z.string(),
                players: z.array(ClashMemberSchema)
            })
        })
    }),
    mastery: new ApiSet('/lol/champion-mastery/v4', {
        byPuuid: (puuid: string) => ({
            endOfUrl: `/champion-masteries/by-puuid/${puuid}`,
            regional: true,
            schema: z.array(MasterySchema)
        }),
        top: (puuid: string, count = 3) => ({
            endOfUrl: `/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
            regional: true,
            schema: z.array(MasterySchema)
        }),
        byChampionId: (puuid: string, championId: number) => ({
            endOfUrl: `/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`,
            regional: true,
            schema: MasterySchema
        })
    })
};

const createForRegion = (region: Region) =>
    RiotAPI(RiotAPIStructure, getBaseURL(region), getBaseRoutingURL(region));

export default Object.fromEntries(
    regions.map((region) => [region, createForRegion(region)])
) as Record<Region, ReturnType<typeof createForRegion>>;
