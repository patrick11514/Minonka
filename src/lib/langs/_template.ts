import { z } from 'zod';
import { regions } from '../Riot/types';

const _ = z.string();

export default z.object({
    genericError: _,
    workerError: _,
    assets: z.object({
        error: _,
        challenges: _
    }),
    riotApi: z.object({
        error: _
    }),
    lang: z.object({
        notFound: _,
        alreadyConnected: _,
        success: _
    }),
    langs: z.object({
        notFound: _,
        accounts: _,
        unlink: z.object({
            placeholder: _,
            notFound: _,
            success: _
        })
    }),
    summoner: z.object({
        choice: _,
        me: z.object({
            notFound: _,
            error: _,
            success: _
        }),
        name: z.object({
            notFound: _,
            error: _,
            success: _
        }),
        mention: z.object({
            notFound: _,
            error: _,
            success: _
        })
    }),
    league: z.object({
        error: _
    }),
    regions: z.object(
        Object.fromEntries(regions.map((region) => [region, _])) as Record<
            (typeof regions)[number],
            typeof _
        >
    )
});
