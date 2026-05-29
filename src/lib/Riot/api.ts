import { z } from 'zod';
import { ApiSet } from './apiSet';
import RiotAPI from './riotApi';
import {
    AccountSchema,
    ChallengeSchema,
    ClashMemberSchema,
    MasterySchema,
    MatchSchema,
    SpectatorSchema,
    SummonerSchema
} from './schemes';
import { rankType, Region, regions, tierType } from './types';

const regionToServer = (region: Region) => {
    switch (region) {
        case 'EUN1':
        case 'EUW1':
        case 'ME1':
        case 'TR1':
        case 'RU':
            return 'EUROPE';
        case 'NA1':
        case 'BR1':
        case 'LA1':
        case 'LA2':
            return 'AMERICAS';
        case 'KR':
        case 'JP1':
            return 'ASIA';
        case 'OC1':
        case 'SG2':
        case 'TW2':
        case 'VN2':
            return 'SEA';
    }
};

const getBaseRoutingURL = (region: Region) =>
    `https://${regionToServer(region)}.api.riotgames.com`;

const getAccountURL = (region: Region) => {
    let server = regionToServer(region);
    if (server === 'SEA') {
        server = 'ASIA';
    }
    return `https://${server}.api.riotgames.com`;
};

const getBaseURL = (region: Region) => {
    return `https://${region}.api.riotgames.com`;
};

const RiotAPIStructure = {
    account: new ApiSet('/riot/account/v1/accounts', {
        name: (gameName: string, tagLine: string) => ({
            type: 'account',
            endOfUrl: `/by-riot-id/${gameName}/${tagLine}`,
            schema: AccountSchema
        }),
        byPuuid: (puuid: string) => ({
            type: 'account',
            endOfUrl: `/by-puuid/${puuid}`,
            schema: AccountSchema
        })
    }),
    summoner: new ApiSet('/lol/summoner/v4/summoners', {
        byPuuid: (puuid: string) => ({
            type: 'regional',
            endOfUrl: `/by-puuid/${puuid}`,
            schema: SummonerSchema
        })
    }),
    challenges: new ApiSet('/lol/challenges/v1', {
        byPuuid: (puuid: string) => ({
            type: 'regional',
            endOfUrl: `/player-data/${puuid}`,
            schema: ChallengeSchema
        })
    }),
    league: new ApiSet('/lol/league/v4', {
        byPuuid: (puuid: string) => ({
            type: 'regional',
            endOfUrl: `/entries/by-puuid/${puuid}`,
            schema: z.array(
                z.object({
                    queueType: z.string(),
                    tier: tierType,
                    rank: rankType,
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
            type: 'routing',
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
            type: 'routing',
            endOfUrl: `/matches/${matchId}`,
            schema: MatchSchema
        })
    }),
    clash: new ApiSet('/lol/clash/v1', {
        tournaments: () => ({
            type: 'regional',
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
            type: 'regional',
            endOfUrl: `/players/by-puuid/${puuid}`,
            schema: z.array(
                ClashMemberSchema.extend({
                    teamId: z.string()
                })
            )
        }),
        team: (teamId: string) => ({
            type: 'regional',
            endOfUrl: `/teams/${teamId}`,
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
            type: 'regional',
            endOfUrl: `/champion-masteries/by-puuid/${puuid}`,
            schema: z.array(MasterySchema)
        }),
        top: (puuid: string, count = 3) => ({
            type: 'regional',
            endOfUrl: `/champion-masteries/by-puuid/${puuid}/top?count=${count}`,
            schema: z.array(MasterySchema)
        }),
        byChampionId: (puuid: string, championId: number) => ({
            type: 'regional',
            endOfUrl: `/champion-masteries/by-puuid/${puuid}/by-champion/${championId}`,
            schema: MasterySchema
        })
    }),
    spectator: new ApiSet('/lol/spectator/v5', {
        byPuuid: (puuid: string) => ({
            type: 'regional',
            endOfUrl: `/active-games/by-summoner/${puuid}`,
            schema: SpectatorSchema
        })
    })
};

const createForRegion = (region: Region) =>
    RiotAPI(
        RiotAPIStructure,
        getBaseURL(region),
        getBaseRoutingURL(region),
        getAccountURL(region)
    );

export default Object.fromEntries(
    regions.map((region) => [region, createForRegion(region)])
) as Record<Region, ReturnType<typeof createForRegion>>;
