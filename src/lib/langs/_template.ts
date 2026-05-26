export enum SubTeam {
    Poro,
    Minion,
    Scuttle,
    Krug,
    Raptor,
    Sentinel,
    Wolf,
    Gromp
}

/*const TeamIdToName = (id: number) => {
    switch (id) {
        case 1:
            return SubTeam.Poro;
        case 2:
            return SubTeam.Minion;
        case 3:
            return SubTeam.Scuttle;
        case 4:
            return SubTeam.Krug;
        case 5:
            return SubTeam.Raptor;
        case 6:
            return SubTeam.Sentinel;
        case 7:
            return SubTeam.Wolf;
        case 8:
            return SubTeam.Gromp;
    }

    return SubTeam.Poro;
};*/

export const subTeamMap = {
    [SubTeam.Poro]: 'poros',
    [SubTeam.Minion]: 'minions',
    [SubTeam.Scuttle]: 'scuttles',
    [SubTeam.Krug]: 'krugs',
    [SubTeam.Raptor]: 'raptors',
    [SubTeam.Sentinel]: 'sentinel',
    [SubTeam.Wolf]: 'wolves',
    [SubTeam.Gromp]: 'gromp'
} as const;

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

const _ = z.string();
const o = z.object;

const additionalClashNames = ['aram2022', 'worlds2024'] as const;

export default o({
    genericError: _,
    workerError: _,
    noPermission: _,
    assets: o({
        error: _,
        challenges: _
    }),
    riotApi: o({
        error: _
    }),
    lang: o({
        notFound: _,
        alreadyConnected: _,
        success: _
    }),
    langs: o({
        notFound: _,
        accounts: _,
        unlink: o({
            placeholder: _,
            notFound: _,
            success: _
        })
    }),
    account: o({
        choice: _,
        me: o({
            notFound: _,
            error: _,
            success: _
        }),
        name: o({
            notFound: _,
            error: _,
            success: _
        }),
        mention: o({
            notFound: _,
            error: _,
            success: _
        })
    }),
    league: o({
        error: _
    }),
    rank: o({
        queues: o({
            RANKED_SOLO_5x5: _,
            RANKED_FLEX_SR: _
        }),
        generatingImage: _,
        sentToChannel: _,
        tiers: o(
            Object.fromEntries(tier.map((tier) => [tier, _])) as Record<
                (typeof tier)[number],
                typeof _
            >
        ),
        wins: _,
        losses: _
    }),
    match: o({
        empty: _,
        results: o({
            [MatchStatus.Win]: _,
            [MatchStatus.Loss]: _,
            [MatchStatus.Remake]: _
        }),
        buttonInfoText: _,
        place: _,
        team: _,
        loading: _,
        uploading: _,
        sentToChannel: _,
        subTeam: o({
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
    clash: o({
        title: _,
        day: _,
        cup: _,
        registration: _,
        start: _,
        successMessage: _,
        generatingImage: _,
        sentToChannel: _,
        canceled: _,
        noTeam: _,
        positions: o(
            Object.fromEntries(positions.map((position) => [position, _])) as Record<
                Position,
                typeof _
            >
        ),
        mapInflection: o(
            Object.fromEntries(
                [...mapRegions, ...additionalClashNames].map((name) => [name, _])
            ) as Record<
                (typeof mapRegions)[number] | (typeof additionalClashNames)[number],
                typeof _
            >
        ),
        noCups: _
    }),
    regions: o(
        Object.fromEntries(regions.map((region) => [region, _])) as Record<
            (typeof regions)[number],
            typeof _
        >
    ),
    queues: o(
        Object.fromEntries(queues.map((queue) => [queue.queueId, _])) as Record<
            QueueId,
            typeof _
        >
    ),
    mapRegions: o(
        Object.fromEntries(mapRegions.map((region) => [region, _])) as Record<
            (typeof mapRegions)[number],
            typeof _
        >
    ),
    unranked: _,
    help: o({
        title: _,
        description: _,
        exampleUsage: _,
        extendedDescription: _,
        parameters: _,
        subcommands: _,
        select: _
    }),
    mastery: o({
        select: _,
        points: _,
        level: _,
        next: _,
        prev: _,
        lastPlayed: _,
        atTime: _,
        sentToChannel: _
    }),
    spectator: o({
        not_in_game: _,
        reload: _,
        generatingImage: _,
        sentToChannel: _
    }),
    summoner: o({
        generatingImage: _,
        sentToChannel: _
    }),
    settings: o({
        invalid_command: _,
        unknown_queue: _,
        invalid_queue: _,
        language: o({
            set: _,
            reset: _
        }),
        defaults: o({
            current: _,
            updated: _,
            reset: _
        })
    })
});
