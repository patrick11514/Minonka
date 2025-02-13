export class RiotAccountID {
    private _type = 'RiotAccountID';
    constructor(public value: string) {}
    get() {
        return this.value;
    }
}

export class RiotSummonerID {
    private _type = 'RiotSummonerID';
    constructor(public value: string) {}
    get() {
        return this.value;
    }
}

export class RiotPUUID {
    private _type = 'RiotPUUID';
    constructor(public value: string) {}
    get() {
        return this.value;
    }
}

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

const tier = [
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
const rank = ['IV', 'III', 'II', 'I'] as const;

const deCapitalize = (str: string) => str.charAt(0) + str.slice(1).toLowerCase();

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
        return `${deCapitalize(tier[this.tier])} ${rank[this.rank]} (${this.lp} LP)`;
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
}
