import { z } from 'zod';
import template from './_template';

export default template.parse({
    genericError: 'Nastala chyba, zkus to prosím později',
    workerError: 'Nastala chyba při generaci obrázku: %1',
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
    }
} satisfies z.infer<typeof template>);
