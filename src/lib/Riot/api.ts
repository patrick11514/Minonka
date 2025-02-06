import { z } from 'zod';
import { ApiSet } from './apiSet';
import { Region, regions } from './types';
import RiotAPI from './riotApi';

const BASE_ROUTING_URL = 'https://EUROPE.api.riotgames.com/riot';
const getBaseURL = (region: Region) => {
    return `https://${region}.api.riotgames.com/riot`;
};

const RiotAPIStructure = {
    account: new ApiSet('/account/v1/accounts', {
        name: (gameName: string, tagLine: string) => ({
            regional: false,
            endOfUrl: `/by-riot-id/${gameName}/${tagLine}`,
            schema: z.object({
                puuid: z.string(),
                gameName: z.string(),
                tagLine: z.string()
            })
        })
    })
};

const createForRegion = (region: Region) => RiotAPI(RiotAPIStructure, getBaseURL(region), BASE_ROUTING_URL);

export default Object.fromEntries(regions.map((region) => [region, createForRegion(region)])) as Record<Region, ReturnType<typeof createForRegion>>;
