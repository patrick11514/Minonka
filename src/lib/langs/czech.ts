import { z } from 'zod';
import template from './_template';
import { MatchStatus } from '../Riot/utilities';

export default template.parse({
    genericError: 'Nastala chyba, zkus to prosím později',
    workerError: 'Nastala chyba při generaci obrázku: %1',
    noPermission: 'Na toto nemáš práva',
    assets: {
        error: 'Nastala chyba při načítání zdrojů: %1',
        challenges: 'Challenge'
    },
    riotApi: {
        error: 'Nastala chyba při komunikaci s Riot API: (%1) %2'
    },
    lang: {
        notFound: 'Účet nenalezen',
        alreadyConnected: 'Tento účet již by propojen s nějakým discord účtem',
        success: 'Účet **%1#%2** s levelem **%3** byl úspěšně propojen'
    },
    langs: {
        notFound: 'Nemáš propojený žádný účet',
        accounts: '## Tvoje propojené účty jsou:\n\n%1',
        unlink: {
            placeholder: 'Vyber účet k odpojení',
            notFound: 'Tento účet již není propojen',
            success: 'Účet **%1#%2** byl úspěšně odpojen'
        }
    },
    account: {
        choice: 'Nalezli jsme více účtů, vyber si jeden z nich:',
        me: {
            notFound: 'Nemáš propojený žádný účet',
            error: 'Nastala chyba, zkus to prosím později',
            success: 'Zde jsou informace o tvém účtu:'
        },
        name: {
            notFound: 'Účet %1#%2 nebyl na serveru %3 nalezen',
            error: 'Nastala chyba, zkus to prosím později',
            success: 'Zde jsou informace o účtu %1#%2 (%3):'
        },
        mention: {
            notFound: 'Uživatel %1 nemá propojený žádný účet',
            error: 'Nastala chyba, zkus to prosím později',
            success: 'Zde jsou informace o účtu %1#%2 (%3):'
        }
    },
    league: {
        error: 'Nepovedlo se získat informace o tvém ranku'
    },
    rank: {
        queues: {
            RANKED_SOLO_5x5: 'Solo/Tandem',
            RANKED_FLEX_SR: 'Flex'
        },
        tiers: {
            IRON: 'Železná',
            BRONZE: 'Bronzová',
            SILVER: 'Stříbrná',
            GOLD: 'Zlatá',
            PLATINUM: 'Platinová',
            EMERALD: 'Smaragdová',
            DIAMOND: 'Diamantová',
            MASTER: 'Mistrovská',
            GRANDMASTER: 'Velmistrovská',
            CHALLENGER: 'Vyzyvatelská'
        },
        wins: 'Výhry',
        losses: 'Prohry'
    },
    match: {
        empty: 'Nebyl nalezený žádný zápas. Zkus upravit filtrování nebo zkusit později.',
        loading: 'Načítám zápasy... %1/%2',
        uploading: 'Nahrávám...',
        results: {
            [MatchStatus.Win]: 'Výhra',
            [MatchStatus.Loss]: 'Prohra',
            [MatchStatus.Remake]: 'Remake'
        },
        buttonInfoText: 'Zobrazuji %1-%2 posledních zápasů',
        place: 'Místo',
        team: 'Tým',
        subTeam: {
            wolves: 'Vlk',
            gromp: 'Ropušák',
            krugs: 'Kameňák',
            minions: 'Poskok',
            poros: 'Poro',
            raptors: 'Raptor',
            scuttles: 'Krab',
            sentinel: 'Strážce'
        }
    },
    clash: {
        title: 'Nadcházející Clash Turnaje',
        day: 'Den',
        cup: 'pohár',
        registration: 'Registrace',
        start: 'Začátek',
        successMessage: 'Zde je id týmu: `%1`',
        canceled: 'Zrušený',
        noTeam: 'Tento hráč není v žádném týmu',
        positions: {
            TOP: 'Horní',
            JUNGLE: 'Džungle',
            MIDDLE: 'Středová',
            BOTTOM: 'Spodní',
            UTILITY: 'Podpora',
            FILL: 'Výplň',
            UNSELECTED: 'Nevybráno'
        },
        mapInflection: {
            demacia: 'Demácijský %1',
            bilgewater: 'Bilgewaterský %1',
            noxus: 'Noxijský %1',
            targon: 'Targonský %1',
            freljord: 'Freljordský %1',
            shurima: 'Shurimský %1',
            ionia: 'Ionský %1',
            piltover: 'Piltoverský %1',
            zaun: 'Zaunský %1',
            shadowIsles: 'Pohár Stínových ostrovů'
        }
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
        420: 'Solo/Tandem',
        430: 'Výběr na slepo',
        440: 'Flexibilní',
        450: 'ARAM',
        480: 'Swiftplay',
        490: 'Quickplay',
        600: 'Blood Hunt Assassin',
        610: 'Dark Star: Singularity',
        700: 'Clash',
        720: 'Aram Clash',
        740: 'ARURF Clash',
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
        demacia: 'Demácie',
        noxus: 'Noxus',
        targon: 'Targon',
        freljord: 'Freljord',
        shurima: 'Shurima',
        ionia: 'Ionia',
        piltover: 'Piltover',
        zaun: 'Zaun',
        bilgewater: 'Bilgewater',
        shadowIsles: 'Stínové ostrovy'
    },
    unranked: 'Nehodnocený',
    help: {
        title: 'Nápověda pro příkaz %1',
        description: 'Popisek',
        exampleUsage: 'Příklad použití',
        extendedDescription: 'Rozšířený popis',
        parameters: 'Parametry',
        subcommands: 'Podpříkazy',
        select: 'Vyber příkaz pro jeho nápovědu'
    },
    mastery: {
        select: 'Vyber postavu pro zobrazení specifické mastery',
        points: 'Bodů',
        level: 'Úroveň',
        next: 'Další stránka',
        prev: 'Předchozí stránka',
        lastPlayed: 'Naposledy hrán',
        atTime: 'v'
    }
} satisfies z.infer<typeof template>);
