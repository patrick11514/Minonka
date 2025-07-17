import english from './english';
import czech from './czech';
import { Locale } from 'discord.js';

export const getLocale = (locale: Locale) => {
    switch (locale) {
        case Locale.Czech:
            return czech;
        default:
            return english;
    }
};

export const replacePlaceholders = (message?: string, ...toReplace: string[]) => {
    if (!message) {
        return 'MISSING_TRANSLATION';
    }

    for (let i = 0; i < toReplace.length; ++i) {
        message = message.replace(`%${i + 1}`, toReplace[i]);
    }

    return message;
};
