import { Region } from '$/lib/Riot/types';
import { Locale } from 'discord.js';

export type DefaultParameters = {
    summonerId: string;
    region: Region;
    level: number;
    gameName: string;
    tagLine: string;
    profileIconId: number;
    locale: Locale;
};
