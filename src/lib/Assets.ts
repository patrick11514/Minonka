import Path from 'node:path';
import fs from 'node:fs';
import { Locale } from 'discord.js';
import Logger from './logger';
import { z } from 'zod';
import { ChallengeTier } from './Riot/schemes';
import { env } from '$/types/env';

const l = new Logger('Assets', 'blue');

export enum AssetType {
    BANNER,
    CREST,
    LANE,
    RANK,
    WING,
    OTHER,
    ///DRAGON TYPES,
    //@TODO
    DDRAGON_DATA,
    DDRAGON_PROFILEICON,
    DDRAGON_CHALLENGES,
    DDRAGON_CHAMPION,
    DDRAGON_IMG,
    DDRAGON_SPELL,
    DDRAGON_ITEM,
    //COMMUNITY DDRAGON,
    COMMUNITY_DDRAGON
}

const ROOT = 'assets';
const ASSET_PATHS = {
    [AssetType.BANNER]: '/banners',
    [AssetType.CREST]: '/crests',
    [AssetType.LANE]: '/lanes',
    [AssetType.RANK]: '/ranks/Ranked Emblems Latest',
    [AssetType.WING]: '/ranks/Ranked Emblems Latest/Wings',
    [AssetType.OTHER]: '/other',
    [AssetType.DDRAGON_DATA]: '/ddragon/_ROOT_/data/%%LANGUAGE%%',
    [AssetType.DDRAGON_PROFILEICON]: '/ddragon/_ROOT_/img/profileicon',
    [AssetType.DDRAGON_CHALLENGES]: '/ddragon/img/challenges-images',
    [AssetType.DDRAGON_CHAMPION]: '/ddragon/_ROOT_/img/champion',
    [AssetType.DDRAGON_IMG]: '/ddragon/img',
    [AssetType.DDRAGON_SPELL]: '/ddragon/_ROOT_/img/spell',
    [AssetType.DDRAGON_ITEM]: '/ddragon/_ROOT_/img/item',
    [AssetType.COMMUNITY_DDRAGON]: 'https://raw.communitydragon.org'
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

export const getAssetPath = async (
    type: AssetType,
    name: string,
    language?: RiotLanguage
) => {
    if (type === AssetType.COMMUNITY_DDRAGON) {
        //we need to download file from the internet into cache folder
        const path = Path.join(env.PERSISTANT_CACHE_PATH, name);
        if (fs.existsSync(path)) {
            return path;
        }

        const href = new URL(`latest/${name}`, ASSET_PATHS[type]).href;

        const response = await fetch(href);
        const buffer = await response.arrayBuffer();

        //create folder structure
        const folder = Path.dirname(path);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        fs.writeFileSync(path, Buffer.from(buffer));

        return path;
    } else {
        return Path.join(ROOT, ASSET_PATHS[type], name).replace(
            '%%LANGUAGE%%',
            language ?? 'en_US'
        );
    }
};

export const checkAsset = async (
    type: AssetType,
    name: string,
    language?: RiotLanguage
) => {
    const path = await getAssetPath(type, name, language);

    if (!fs.existsSync(path)) {
        return false;
    }

    return path;
};

export const getAsset = async (
    type: AssetType,
    name: string,
    language?: RiotLanguage
) => {
    const path = await getAssetPath(type, name, language);

    if (!fs.existsSync(path)) {
        return null;
    }

    return fs.readFileSync(path);
};

export const getChallenges = async (lang: RiotLanguage) => {
    const schema = z.array(
        z.object({
            id: z.number(),
            name: z.string(),
            description: z.string(),
            thresholds: z
                .record(
                    ChallengeTier,
                    z.object({
                        value: z.number(),
                        rewards: z
                            .array(
                                z.object({
                                    category: z.string(),
                                    quantity: z.number(),
                                    title: z.string().optional()
                                })
                            )
                            .optional()
                    })
                )
                .optional()
        })
    );

    try {
        const challenges = schema.parse(
            JSON.parse(
                (await getAsset(
                    AssetType.DDRAGON_DATA,
                    'challenges.json',
                    lang
                ))!.toString()
            )
        );
        return challenges;
    } catch (e) {
        l.error(e);
        return null;
    }
};

export const getRunesReforged = async (lang: RiotLanguage) => {
    const BaseRune = z.object({
        id: z.number(),
        key: z.string(),
        icon: z.string(),
        name: z.string()
    });

    const schema = z.array(
        BaseRune.merge(
            z.object({
                slots: z.array(
                    z.object({
                        runes: z.array(
                            BaseRune.merge(
                                z.object({
                                    shortDesc: z.string(),
                                    longDesc: z.string()
                                })
                            )
                        )
                    })
                )
            })
        )
    );

    try {
        const runes = schema.parse(
            JSON.parse(
                (await getAsset(
                    AssetType.DDRAGON_DATA,
                    'runesReforged.json',
                    lang
                ))!.toString()
            )
        );
        return runes;
    } catch (e) {
        l.error(e);
        return null;
    }
};

export const getSummonerSpells = async (lang: RiotLanguage) => {
    const schema = z.object({
        type: z.literal('summoner'),
        data: z.record(
            z.string(),
            z.object({
                key: z.coerce.number(),
                image: z.object({
                    full: z.string()
                })
            })
        )
    });

    try {
        const spells = schema.parse(
            JSON.parse(
                (await getAsset(
                    AssetType.DDRAGON_DATA,
                    'summoner.json',
                    lang
                ))!.toString()
            )
        );
        return spells;
    } catch (e) {
        l.error(e);
        return null;
    }
};
