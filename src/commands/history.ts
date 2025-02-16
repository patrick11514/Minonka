import { AccountCommand } from '$/lib/AccountCommand';
import { getLocale } from '$/lib/langs';
import czech from '$/lib/langs/czech';
import english from '$/lib/langs/english';
import { queues, Region } from '$/lib/Riot/types';
import {
    RepliableInteraction,
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    Interaction
} from 'discord.js';
import { queue } from 'sharp';

export default class History extends AccountCommand {
    constructor() {
        super('history', 'Show you match history of last 5 games', {
            me: {
                description: 'Show your match history of last 5 games',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí tvou historii posledních 5 her'
                }
            },
            name: {
                description: 'Show match history of another player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí historii her jiného hráče'
                }
            },
            mention: {
                description: 'Show match history of mentioned player',
                localizedDescription: {
                    [Locale.Czech]: 'Zobrazí historii her zmíněného hráče'
                }
            }
        });
        super.addLocalization(
            Locale.Czech,
            'historie',
            'Zobrazí tvou historii posledních 5 her'
        );
        for (const subCommand of [
            this.meSubCommand,
            this.nameSubCommand,
            this.mentionSubCommand
        ]) {
            subCommand.addOption({
                name: 'queue',
                description: 'Select queue for filtering',
                localizedName: {
                    [Locale.Czech]: 'queue'
                },
                localizedDescription: {
                    [Locale.Czech]: 'Vyber queue pro filtrování'
                },
                type: 'STRING',
                required: false,
                autocomplete: true
            });
        }

        super.on('interactionCreate', this.autocomplete);
    }

    async onMenuSelect(
        interaction: RepliableInteraction<CacheType>,
        summonerId: string,
        region: Region
    ) {
        throw new Error('Method not implemented.');
    }

    async handler(interaction: ChatInputCommandInteraction) {
        throw new Error('Method not implemented.');
    }

    async autocomplete(interaction: Interaction) {
        if (!interaction.isAutocomplete()) return;
        if (interaction.commandName !== 'history') return;

        const lang = getLocale(interaction.locale);

        const option = interaction.options.getFocused(true);

        const options = queues
            .map((queue) => {
                return {
                    name: lang.queues[queue.queueId],
                    value: queue.queueId.toString()
                };
            })
            .filter((opt) => opt.name.toLowerCase().includes(option.value.toLowerCase()));

        await interaction.respond(options.slice(0, 25));
    }
}
