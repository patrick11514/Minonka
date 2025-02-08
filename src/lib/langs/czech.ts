import { z } from 'zod';
import template from './_template';

export default template.parse({
    genericError: 'Nastala chyba, zkus to prosím později',
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
