export const regions = [
    'BR1',
    'EUN1',
    'EUW1',
    'JP1',
    'KR',
    'LA1',
    'LA2',
    'NA1',
    'OC1',
    'TR1',
    'RU',
    'SG2',
    'TW2',
    'VN2',
    'ME1'
] as const;
export type Region = (typeof regions)[number];

export const tier = [
    'IRON',
    'BRONZE',
    'SILVER',
    'GOLD',
    'PLATINUM',
    'EMERALD',
    'DIAMOND',
    'MASTER',
    'GRANDMASTER',
    'CHALLENGER'
] as const;
export type _Tier = (typeof tier)[number];

const rank = ['IV', 'III', 'II', 'I'] as const;
export type _Rank = (typeof rank)[number];

export const deCapitalize = (str: string) => str.charAt(0) + str.slice(1).toLowerCase();

export class Rank {
    private tier: number;
    private rank: number;
    private lp: number;

    constructor(src: { tier: string; rank: string; leaguePoints: number }) {
        this.tier = tier.findIndex((v) => v === src.tier);
        this.rank = rank.findIndex((v) => v === src.rank);
        this.lp = src.leaguePoints;
    }

    getLp() {
        return this.lp;
    }

    getTotalLp() {
        return this.tier * 400 + this.rank * 100 + this.lp;
    }

    toString() {
        if (this.isTiered()) {
            return `${deCapitalize(tier[this.tier])} ${rank[this.rank]} (${this.lp} LP)`;
        }

        return `${deCapitalize(tier[this.tier])} (${this.lp} LP)`;
    }

    valueOf() {
        return this.getTotalLp();
    }

    toNumber() {
        return this.getTotalLp();
    }

    getTier() {
        return tier[this.tier];
    }

    getRank() {
        return rank[this.rank];
    }

    isTiered() {
        return this.tier < 7;
    }
}

//SOURCE: https://static.developer.riotgames.com/docs/lol/queues.json
export const queues = [
    {
        queueId: 0,
        map: 'Custom games',
        description: null,
        notes: null
    },
    {
        queueId: 72,
        map: 'Howling Abyss',
        description: '1v1 Snowdown Showdown games',
        notes: null
    },
    {
        queueId: 73,
        map: 'Howling Abyss',
        description: '2v2 Snowdown Showdown games',
        notes: null
    },
    {
        queueId: 75,
        map: "Summoner's Rift",
        description: '6v6 Hexakill games',
        notes: null
    },
    {
        queueId: 76,
        map: "Summoner's Rift",
        description: 'Ultra Rapid Fire games',
        notes: null
    },
    {
        queueId: 78,
        map: 'Howling Abyss',
        description: 'One For All: Mirror Mode games',
        notes: null
    },
    {
        queueId: 83,
        map: "Summoner's Rift",
        description: 'Co-op vs AI Ultra Rapid Fire games',
        notes: null
    },
    {
        queueId: 310,
        map: "Summoner's Rift",
        description: 'Nemesis games',
        notes: null
    },
    {
        queueId: 313,
        map: "Summoner's Rift",
        description: 'Black Market Brawlers games',
        notes: null
    },

    {
        queueId: 317,
        map: 'Crystal Scar',
        description: 'Definitely Not Dominion games',
        notes: null
    },

    {
        queueId: 325,
        map: "Summoner's Rift",
        description: 'All Random games',
        notes: null
    },
    {
        queueId: 400,
        map: "Summoner's Rift",
        description: '5v5 Draft Pick games',
        notes: null
    },

    {
        queueId: 420,
        map: "Summoner's Rift",
        description: '5v5 Ranked Solo games',
        notes: null
    },
    {
        queueId: 430,
        map: "Summoner's Rift",
        description: '5v5 Blind Pick games',
        notes: null
    },
    {
        queueId: 440,
        map: "Summoner's Rift",
        description: '5v5 Ranked Flex games',
        notes: null
    },
    {
        queueId: 450,
        map: 'Howling Abyss',
        description: '5v5 ARAM games',
        notes: null
    },
    {
        queueId: 480,
        map: "Summoner's Rift",
        description: 'Swiftplay games',
        notes: null
    },
    {
        queueId: 490,
        map: "Summoner's Rift",
        description: 'Normal (Quickplay)',
        notes: null
    },
    {
        queueId: 600,
        map: "Summoner's Rift",
        description: 'Blood Hunt Assassin games',
        notes: null
    },
    {
        queueId: 610,
        map: 'Cosmic Ruins',
        description: 'Dark Star: Singularity games',
        notes: null
    },
    {
        queueId: 700,
        map: "Summoner's Rift",
        description: "Summoner's Rift Clash games",
        notes: null
    },
    {
        queueId: 720,
        map: 'Howling Abyss',
        description: 'ARAM Clash games',
        notes: null
    },
    {
        queueId: 870,
        map: "Summoner's Rift",
        description: 'Co-op vs. AI Intro Bot games',
        notes: null
    },
    {
        queueId: 880,
        map: "Summoner's Rift",
        description: 'Co-op vs. AI Beginner Bot games',
        notes: null
    },
    {
        queueId: 890,
        map: "Summoner's Rift",
        description: 'Co-op vs. AI Intermediate Bot games',
        notes: null
    },
    {
        queueId: 900,
        map: "Summoner's Rift",
        description: 'ARURF games',
        notes: null
    },
    {
        queueId: 910,
        map: 'Crystal Scar',
        description: 'Ascension games',
        notes: null
    },
    {
        queueId: 920,
        map: 'Howling Abyss',
        description: 'Legend of the Poro King games',
        notes: null
    },
    {
        queueId: 940,
        map: "Summoner's Rift",
        description: 'Nexus Siege games',
        notes: null
    },
    {
        queueId: 950,
        map: "Summoner's Rift",
        description: 'Doom Bots Voting games',
        notes: null
    },
    {
        queueId: 960,
        map: "Summoner's Rift",
        description: 'Doom Bots Standard games',
        notes: null
    },
    {
        queueId: 980,
        map: 'Valoran City Park',
        description: 'Star Guardian Invasion: Normal games',
        notes: null
    },
    {
        queueId: 990,
        map: 'Valoran City Park',
        description: 'Star Guardian Invasion: Onslaught games',
        notes: null
    },
    {
        queueId: 1000,
        map: 'Overcharge',
        description: 'PROJECT: Hunters games',
        notes: null
    },
    {
        queueId: 1010,
        map: "Summoner's Rift",
        description: 'Snow ARURF games',
        notes: null
    },
    {
        queueId: 1020,
        map: "Summoner's Rift",
        description: 'One for All games',
        notes: null
    },
    {
        queueId: 1030,
        map: 'Crash Site',
        description: 'Odyssey Extraction: Intro games',
        notes: null
    },
    {
        queueId: 1040,
        map: 'Crash Site',
        description: 'Odyssey Extraction: Cadet games',
        notes: null
    },
    {
        queueId: 1050,
        map: 'Crash Site',
        description: 'Odyssey Extraction: Crewmember games',
        notes: null
    },
    {
        queueId: 1060,
        map: 'Crash Site',
        description: 'Odyssey Extraction: Captain games',
        notes: null
    },
    {
        queueId: 1070,
        map: 'Crash Site',
        description: 'Odyssey Extraction: Onslaught games',
        notes: null
    },
    {
        queueId: 1300,
        map: 'Nexus Blitz',
        description: 'Nexus Blitz games',
        notes: null
    },
    {
        queueId: 1400,
        map: "Summoner's Rift",
        description: 'Ultimate Spellbook games',
        notes: null
    },
    {
        queueId: 1700,
        map: 'Rings of Wrath',
        description: 'Arena',
        notes: null
    },
    {
        queueId: 1710,
        map: 'Rings of Wrath',
        description: 'Arena',
        notes: '16 player lobby'
    },
    {
        queueId: 1810,
        map: 'Swarm',
        description: 'Swarm Mode Games',
        notes: 'Swarm Mode 1 player'
    },
    {
        queueId: 1820,
        map: 'Swarm Mode Games',
        description: 'Swarm',
        notes: 'Swarm Mode 2 players'
    },
    {
        queueId: 1830,
        map: 'Swarm Mode Games',
        description: 'Swarm',
        notes: 'Swarm Mode 3 players'
    },
    {
        queueId: 1840,
        map: 'Swarm Mode Games',
        description: 'Swarm',
        notes: 'Swarm Mode 4 players'
    },
    {
        queueId: 1900,
        map: "Summoner's Rift",
        description: 'Pick URF games',
        notes: null
    },
    {
        queueId: 2000,
        map: "Summoner's Rift",
        description: 'Tutorial 1',
        notes: null
    },
    {
        queueId: 2010,
        map: "Summoner's Rift",
        description: 'Tutorial 2',
        notes: null
    },
    {
        queueId: 2020,
        map: "Summoner's Rift",
        description: 'Tutorial 3',
        notes: null
    }
] as const;

export type QueueId = (typeof queues)[number]['queueId'];

export const mapRegions = [
    'noxus',
    'demacia',
    'targon',
    'shurima',
    'zaun',
    'bilgewater',
    'freljord',
    'ionia',
    'piltover',
    'shadowIsles'
] as const;
