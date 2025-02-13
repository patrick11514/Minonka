import { z } from 'zod';
import { regions, tier } from '../Riot/types';

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
    account: z.object({
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
    rank: z.object({
        queues: z.object({
            RANKED_SOLO_5x5: _,
            RANKED_FLEX_SR: _
        }),
        tiers: z.object(
            Object.fromEntries(tier.map((tier) => [tier, _])) as Record<
                (typeof tier)[number],
                typeof _
            >
        ),
        wins: _,
        losses: _
    }),
    regions: z.object(
        Object.fromEntries(regions.map((region) => [region, _])) as Record<
            (typeof regions)[number],
            typeof _
        >
    )
});
