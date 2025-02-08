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

export const regions = ['BR1', 'EUN1', 'EUW1', 'JP1', 'KR', 'LA1', 'LA2', 'NA1', 'OC1', 'TR1', 'RU', 'SG2', 'TW2', 'VN2', 'ME1'] as const;
export type Region = (typeof regions)[number];
