import Path from 'node:path';
import fs from 'node:fs';
import { Locale } from 'discord.js';

export enum AssetType {
    BANNER,
    CREST,
    LANE,
    RANK,
    WING,
    ///DRAGON TYPES,
    //@TODO
    DDRAGON_DATA
}

const ROOT = 'assets';
const ASSET_PATHS = {
    [AssetType.BANNER]: '/banners',
    [AssetType.CREST]: '/crests',
    [AssetType.LANE]: '/lanes',
    [AssetType.RANK]: '/ranks/Ranked Emblems Latest',
    [AssetType.WING]: '/ranks/Ranked Emblems Latest/Wings',
    [AssetType.DDRAGON_DATA]: '/ddragon/_ROOT_/data/%%LANGUAGE%%'
} satisfies Record<AssetType, string>;

export type RiotLanguage =
    | 'ar_AE'
    | 'cs_CZ'
    | 'de_DE'
    | 'el_GR'
    | 'en_AU'
    | 'en_GB'
    | 'en_PH'
    | 'en_SG'
    | 'en_US'
    | 'es_AR'
    | 'es_ES'
    | 'es_MX'
    | 'fr_FR'
    | 'hu_HU'
    | 'id_ID'
    | 'it_IT'
    | 'ja_JP'
    | 'ko_KR'
    | 'pl_PL'
    | 'pt_BR'
    | 'ro_RO'
    | 'ru_RU'
    | 'th_TH'
    | 'tr_TR'
    | 'vi_VN'
    | 'zh_CN'
    | 'zh_MY'
    | 'zh_TW';

export const getRiotLanguageFromDiscordLocale = (locale: Locale): RiotLanguage => {
    switch (locale) {
        case Locale.Thai:
            return 'th_TH';
        case Locale.Vietnamese:
            return 'vi_VN';
        case Locale.Turkish:
            return 'tr_TR';
        case Locale.Russian:
            return 'ru_RU';
        case Locale.PortugueseBR:
            return 'pt_BR';
        case Locale.Polish:
            return 'pl_PL';
        case Locale.Japanese:
            return 'ja_JP';
        case Locale.Italian:
            return 'it_IT';
        case Locale.German:
            return 'de_DE';
        case Locale.Czech:
            return 'cs_CZ';
        case Locale.French:
            return 'fr_FR';
        case Locale.EnglishGB:
            return 'en_GB';
        case Locale.EnglishUS:
            return 'en_US';
        case Locale.Greek:
            return 'el_GR';
        case Locale.SpanishES:
            return 'es_ES';
        case Locale.SpanishLATAM:
            return 'es_MX';
        case Locale.Bulgarian:
            return 'ro_RO';
        case Locale.Hungarian:
            return 'hu_HU';
        case Locale.Indonesian:
            return 'id_ID';
        case Locale.Korean:
            return 'ko_KR';
        case Locale.ChineseCN:
            return 'zh_CN';
        case Locale.ChineseTW:
            return 'zh_TW';
        default:
            return 'en_US';
    }
};

const getAssetPath = (type: AssetType, name: string, language?: RiotLanguage) => {
    return Path.join(ROOT, ASSET_PATHS[type], name).replace(
        '%%LANGUAGE%%',
        language ?? 'en_US'
    );
};

export const checkAsset = (type: AssetType, name: string, language?: RiotLanguage) => {
    const path = getAssetPath(type, name, language);

    if (!fs.existsSync(path)) {
        return false;
    }

    return path;
};

export const getAsset = (type: AssetType, name: string, language?: RiotLanguage) => {
    const path = getAssetPath(type, name, language);

    if (!fs.existsSync(path)) {
        return null;
    }

    return fs.readFileSync(path);
};
