import { Locale } from 'discord.js';
import { Command } from './Command';
import { SubCommand } from './SubCommand';
import { getLocale } from './langs';
import { Rank, Region, regions } from './Riot/types';
import api from './Riot/api';
import { formatErrorResponse } from './Riot/baseRequest';
import { getChampions, RiotLanguage } from './Assets';

export const setupRiotOptions = (instance: Command | SubCommand) => {
    instance.addOption({
        type: 'STRING',
        name: 'name',
        localizedName: {
            [Locale.Czech]: 'jméno'
        },
        description: 'Riot Name before #',
        localizedDescription: {
            [Locale.Czech]: 'Jméno před #'
        },
        required: true
    });
    instance.addOption({
        type: 'STRING',
        name: 'tag',
        localizedName: {
            [Locale.Czech]: 'tag'
        },
        description: 'Riot Tag after #',
        localizedDescription: {
            [Locale.Czech]: 'Tag za #'
        },
        required: true
    });
    addRegionOption(instance);
};

export const addRegionOption = (instance: Command | SubCommand) => {
    instance.addOption({
        type: 'STRING',
        name: 'region',
        localizedName: {
            [Locale.Czech]: 'region'
        },
        description: 'Your lol region',
        localizedDescription: {
            [Locale.Czech]: 'Tvůj lol region'
        },
        required: true,
        choices: regions.map((region) => {
            return {
                value: region,
                name: getLocale(Locale.EnglishUS).regions[region],
                name_localizations: {
                    [Locale.Czech]: getLocale(Locale.Czech).regions[region]
                }
            };
        })
    });
};

export const discordLocaleToJSLocale = (locale: Locale) => {
    switch (locale) {
        case Locale.EnglishUS:
            return 'en-US';
        case Locale.Czech:
            return 'cs-CZ';
        case Locale.German:
            return 'de-DE';
        case Locale.French:
            return 'fr-FR';
        case Locale.Italian:
            return 'it-IT';
        case Locale.Polish:
            return 'pl-PL';
        case Locale.Russian:
            return 'ru-RU';
        case Locale.SpanishES:
            return 'es-ES';
        case Locale.SpanishLATAM:
            return 'es-MX';
        case Locale.PortugueseBR:
            return 'pt-BR';
        case Locale.Turkish:
            return 'tr-TR';
        case Locale.Vietnamese:
            return 'vi-VN';
        case Locale.Thai:
            return 'th-TH';
        case Locale.Japanese:
            return 'ja-JP';
        case Locale.Dutch:
            return 'nl-NL';
        case Locale.Korean:
            return 'ko-KR';
        case Locale.Indonesian:
            return 'id-ID';
        case Locale.Hungarian:
            return 'hu-HU';
        case Locale.Bulgarian:
            return 'bg-BG';
        case Locale.Greek:
            return 'el-GR';
        case Locale.Hindi:
            return 'hi-IN';
        case Locale.Swedish:
            return 'sv-SE';
        case Locale.Danish:
            return 'da-DK';
        case Locale.Norwegian:
            return 'no-NO';
        case Locale.Finnish:
            return 'fi-FI';
        case Locale.Croatian:
            return 'hr-HR';
        case Locale.Romanian:
            return 'ro-RO';
        case Locale.ChineseCN:
            return 'zh-CN';
        case Locale.ChineseTW:
            return 'zh-TW';
        case Locale.EnglishGB:
            return 'en-GB';
        case Locale.Ukrainian:
            return 'uk-UA';
        case Locale.Lithuanian:
            return 'lt-LT';
    }
};

export const getHighestRank = async (
    puuid: string,
    region: Region,
    lang: ReturnType<typeof getLocale>
) => {
    const ranks = await api[region].league.byPuuid(puuid);
    if (!ranks.status) {
        throw new Error(formatErrorResponse(lang, ranks));
    }

    ranks.data.sort((a, b) => new Rank(b).getTotalLp() - new Rank(a).getTotalLp());

    return ranks.data[0];
};

export const formatNumbersWithSuffix = (number: number) => {
    const orders = ['k', 'm', 'b', 't'];

    if (number < 1000) {
        return number.toString();
    }

    const order = Math.floor(Math.log10(number) / 3);

    const orderValue = orders[order - 1] || '';
    const value = (number / Math.pow(1000, order)).toFixed(1);
    return `${value}${orderValue}`;
};

export const getChampionsMap = async (lang: RiotLanguage) => {
    const champions = (await getChampions(lang))!;

    const map = new Map<number, (typeof champions)['data'][string]>();
    for (const champion of Object.values(champions.data)) {
        map.set(champion.key, champion);
    }
    return map;
};
