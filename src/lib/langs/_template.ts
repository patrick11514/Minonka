import { z } from 'zod';
import {
    mapRegions,
    Position,
    positions,
    QueueId,
    queues,
    regions,
    tier
} from '../Riot/types';
import { MatchStatus } from '../Riot/utilities';
import { subTeamMap } from '$/Worker/tasks/cherryMatch';

const _ = z.string();

export default z.object({
    genericError: _,
    workerError: _,
    noPermission: _,
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
    match: z.object({
        empty: _,
        results: z.object({
            [MatchStatus.Win]: _,
            [MatchStatus.Loss]: _,
            [MatchStatus.Remake]: _
        }),
        buttonInfoText: _,
        place: _,
        team: _,
        loading: _,
        uploading: _,
        subTeam: z.object({
            poros: _,
            minions: _,
            scuttles: _,
            krugs: _,
            raptors: _,
            sentinel: _,
            wolves: _,
            gromp: _
        } satisfies Record<(typeof subTeamMap)[keyof typeof subTeamMap], typeof _>)
    }),
    clash: z.object({
        title: _,
        day: _,
        cup: _,
        registration: _,
        start: _,
        successMessage: _,
        canceled: _,
        noTeam: _,
        positions: z.object(
            Object.fromEntries(positions.map((position) => [position, _])) as Record<
                Position,
                typeof _
            >
        ),
        mapInflection: z.object(
            Object.fromEntries(mapRegions.map((region) => [region, _])) as Record<
                (typeof mapRegions)[number],
                typeof _
            >
        )
    }),
    regions: z.object(
        Object.fromEntries(regions.map((region) => [region, _])) as Record<
            (typeof regions)[number],
            typeof _
        >
    ),
    queues: z.object(
        Object.fromEntries(queues.map((queue) => [queue.queueId, _])) as Record<
            QueueId,
            typeof _
        >
    ),
    mapRegions: z.object(
        Object.fromEntries(mapRegions.map((region) => [region, _])) as Record<
            (typeof mapRegions)[number],
            typeof _
        >
    ),
    unranked: _
});
