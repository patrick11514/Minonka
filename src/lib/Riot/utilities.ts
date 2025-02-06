import { RiotAccountID, RiotPUUID, RiotSummonerID } from './types';

export const _RiotPUUID = (value: string) => new RiotPUUID(value);
export const _RiotSummonerID = (value: string) => new RiotSummonerID(value);
export const _RiotAccountID = (value: string) => new RiotAccountID(value);
