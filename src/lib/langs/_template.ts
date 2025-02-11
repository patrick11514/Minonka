import { z } from 'zod';
import { regions } from '../Riot/types';

const _ = z.string();

export default z.object({
    genericError: _,
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
    regions: z.object(Object.fromEntries(regions.map((region) => [region, _])) as Record<(typeof regions)[number], typeof _>)
});
