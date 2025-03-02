import { z } from 'zod';
import template from './_template';
import { MatchStatus } from '../Riot/utilities';
import { mapRegions } from '../Riot/types';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

type ClashMapInflection<$Keys extends readonly string[]> = {
    [K in $Keys[number]]: string;
};

export default template.parse({
    genericError: 'There was an error, please try again later',
    workerError: 'There was and error, while generating image: %1',
    noPermission: 'You do not have permission to do that',
    assets: {
        error: 'There was an error while loading assets: %1',
        challenges: 'Challenge'
    },
    riotApi: {
        error: 'There was an error while comunicating with Riot API: (%1) %2'
    },
    lang: {
        notFound: 'Account not found',
        alreadyConnected: 'This account is already connected with some discord account',
        success: 'Account **%1#%2** with level **%3** was successfully connected'
    },
    langs: {
        notFound: "You don't have any connected account",
        accounts: '## Your connected accounts are:\n\n%1',
        unlink: {
            placeholder: 'Select account to unlink',
            notFound: 'This account is no longer connected',
            success: 'Account **%1#%2** was successfully unlinked'
        }
    },
    account: {
        choice: "We've found multiple accounts, select one of them:",
        me: {
            notFound: "You don't have any connected account",
            error: 'There was an error, please try again later',
            success: 'Here are informations about your account:'
        },
        name: {
            notFound: 'Account %1#%2 was not found on server %3',
            error: 'There was an error, please try again later',
            success: 'Here are informations about account %1#%2 (%3):'
        },
        mention: {
            notFound: 'User %1 does not have any connected account',
            error: 'There was an error, please try again later',
            success: 'Here are informations about account %1#%2 (%3):'
        }
    },
    league: {
        error: 'We were unable to get your ranked data'
    },
    rank: {
        queues: {
            RANKED_SOLO_5x5: 'Solo/Duo',
            RANKED_FLEX_SR: 'Flex'
        },
        tiers: {
            IRON: 'Iron',
            BRONZE: 'Bronze',
            SILVER: 'Silver',
            GOLD: 'Gold',
            PLATINUM: 'Platinum',
            EMERALD: 'Emerald',
            DIAMOND: 'Diamond',
            MASTER: 'Master',
            GRANDMASTER: 'Grandmaster',
            CHALLENGER: 'Challenger'
        },
        wins: 'Wins',
        losses: 'Losses'
    },
    match: {
        empty: 'No match found. Try to adjust filters, or try again later',
        results: {
            [MatchStatus.Win]: 'Win',
            [MatchStatus.Loss]: 'Lose',
            [MatchStatus.Remake]: 'Remake'
        },
        buttonInfoText: 'Showing %1-%2 last matches'
    },
    clash: {
        title: 'Upcoming Clash Tournaments',
        day: 'Day',
        cup: 'cup',
        registration: 'Registration',
        start: 'Start',
        successMessage: "Here's the team id: `%1`",
        canceled: 'Canceled',
        positions: {
            TOP: 'Top',
            JUNGLE: 'Jungle',
            MIDDLE: 'Mid',
            BOTTOM: 'ADC',
            UTILITY: 'Support',
            FILL: 'Fill',
            UNSELECTED: 'Unselected'
        },
        mapInflection: Object.fromEntries(
            mapRegions.map((region) => [region, `${capitalize(region)} %1`])
        ) as ClashMapInflection<typeof mapRegions>
    },
    regions: {
        EUN1: 'EUNE',
        EUW1: 'EUW',
        NA1: 'NA',
        KR: 'KR',
        BR1: 'BR',
        LA1: 'LAN',
        LA2: 'LAS',
        OC1: 'OCE',
        RU: 'RU',
        TR1: 'TR',
        JP1: 'JP',
        SG2: 'SEA',
        TW2: 'TW',
        VN2: 'VN',
        ME1: 'ME'
    },
    queues: {
        0: 'Custom',
        72: '1v1 Snowdown Showdown',
        73: '2v2 Snowdown Showdown',
        75: '6v6 Hexakill',
        76: 'Ultra Rapid Fire',
        78: 'One For All: Mirror Mode',
        83: 'Co-op vs AI Ultra Rapid Fire',
        310: 'Nemesis Draft',
        313: 'Black Market Brawlers',
        317: 'Definitely Not Dominion',
        325: 'All Random',
        400: 'Draft',
        420: 'Solo/Duo',
        430: 'Blind Pick',
        440: 'Flex',
        450: 'ARAM',
        480: 'Swiftplay',
        490: 'Quickplay',
        600: 'Blood Hunt Assassin',
        610: 'Dark Star: Singularity',
        700: 'Clash',
        720: 'Aram Clash',
        870: 'Coop vs AI Intro',
        880: 'Coop vs AI Beginner',
        890: 'Coop vs AI Intermediate',
        900: 'ARURF',
        910: 'Ascension',
        920: 'Legend of the Poro King',
        940: 'Nexus Siege',
        950: 'Doom Bots Voting',
        960: 'Doom Bots Standard',
        980: 'Star Guardian Invasion: Normal',
        990: 'Star Guardian Invasion: Onslaught',
        1000: 'PROJECT: Hunters',
        1010: 'Snow ARURF',
        1020: 'One for All',
        1030: 'Odyssey Extraction: Intro',
        1040: 'Odyssey Extraction: Cadet',
        1050: 'Odyssey Extraction: Crewmember',
        1060: 'Odyssey Extraction: Captain',
        1070: 'Odyssey Extraction: Onslaught',
        1300: 'Nexus Blitz',
        1400: 'Ultimate Spellbook',
        1700: 'Arena',
        1710: 'Arena (4v4v4v4)',
        1810: 'Swarm',
        1820: 'Swarm',
        1830: 'Swarm',
        1840: 'Swarm',
        1900: 'Pick URF',
        2000: 'Tutorial 1',
        2010: 'Tutorial 2',
        2020: 'Tutorial 3'
    },
    mapRegions: {
        bilgewater: 'Bilgewater',
        demacia: 'Demacia',
        freljord: 'Freljord',
        ionia: 'Ionia',
        noxus: 'Noxus',
        piltover: 'Piltover',
        shadowIsles: 'Shadow Isles',
        shurima: 'Shurima',
        targon: 'Targon',
        zaun: 'Zaun'
    },
    unranked: 'Unranked'
} satisfies z.infer<typeof template>);
