import { Region } from '$/lib/Riot/types';
import { DePromise } from '$/types/types';
import { Locale } from 'discord.js';

export type DefaultParameters = {
    puuid: string;
    region: Region;
    level: number;
    gameName: string;
    tagLine: string;
    profileIconId: number;
    locale: Locale;
};

type WithoutNull<$Type> = $Type extends null ? never : $Type;
//eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExtractAssetResult<$Function extends (...data: any[]) => any> = WithoutNull<
    DePromise<ReturnType<$Function>>
>;
