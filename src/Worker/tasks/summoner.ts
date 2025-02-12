import { AssetType, getAsset, getRiotLanguageFromDiscordLocale } from '$/lib/Assets';
import { Locale } from 'discord.js';

export type SummonerData = {
    level: number;
    gameName: string;
    tagLine: string;
    profileIconId: number;
    titleId: string;
    crest: number;
    banner: number;
    challenges: number[];
    locale: Locale;
};

export default async (data: SummonerData) => {
    console.log(data);
    console.log(
        getAsset(
            AssetType.DDRAGON_DATA,
            'challenges.json',
            getRiotLanguageFromDiscordLocale(data.locale)
        )
    );

    return 'LOL';
};
