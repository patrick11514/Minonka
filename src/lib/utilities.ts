import { Locale } from 'discord.js';
import { Command } from './Command';
import { SubCommand } from './SubCommand';
import { getLocale } from './langs';
import { regions } from './Riot/types';

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
