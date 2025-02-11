import { z } from 'zod';
import { ApiSet } from './apiSet';
import { Region, regions } from './types';
import RiotAPI from './riotApi';

const BASE_ROUTING_URL = 'https://EUROPE.api.riotgames.com';
const getBaseURL = (region: Region) => {
    return `https://${region}.api.riotgames.com`;
};

const RiotAPIStructure = {
    account: new ApiSet('/riot/account/v1/accounts', {
        name: (gameName: string, tagLine: string) => ({
            regional: false,
            endOfUrl: `/by-riot-id/${gameName}/${tagLine}`,
            schema: z.object({
                puuid: z.string(),
                gameName: z.string(),
                tagLine: z.string()
            })
        })
    }),
    summoner: new ApiSet('/lol/summoner/v4/summoners', {
        byPuuid: (puuid: string) => ({
            regional: true,
            endOfUrl: `/by-puuid/${puuid}`,
            schema: z.object({
                accountId: z.string(),
                profileIconId: z.number(),
                revisionDate: z.number(),
                id: z.string(),
                puuid: z.string(),
                summonerLevel: z.number()
            })
        })
    })
};

const createForRegion = (region: Region) =>
    RiotAPI(RiotAPIStructure, getBaseURL(region), BASE_ROUTING_URL);

export default Object.fromEntries(
    regions.map((region) => [region, createForRegion(region)])
) as Record<Region, ReturnType<typeof createForRegion>>;
