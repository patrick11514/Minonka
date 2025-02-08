import { z } from 'zod';
import template from './_template';

export default template.parse({
    genericError: 'There was an error, please try again later',
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
    summoner: {
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
