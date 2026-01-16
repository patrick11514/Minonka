import {
    ChatInputCommandInteraction,
    Interaction,
    Locale,
    MessageFlags
} from 'discord.js';
import { Command } from '../lib/Command';
import { queues } from '../lib/Riot/types';
import { SubCommand } from '../lib/SubCommand';
import { SubCommandGroup } from '../lib/SubCommandGroup';
import { userSettings } from '../lib/UserSettings';
import { getLocale, replacePlaceholders } from '../lib/langs';

export default class Settings extends Command {
    private handlers: Record<
        string,
        Record<string, (interaction: ChatInputCommandInteraction) => Promise<void>>
    > = {};

    constructor() {
        super('settings', 'Manage your user settings');
        this.addLocalization(
            Locale.Czech,
            'nastaveni',
            'Spravuj svá uživatelská nastavení'
        );

        const languageGroup = new SubCommandGroup(
            'language',
            'Manage your language settings'
        );
        languageGroup.addLocalization(Locale.Czech, 'jazyk', 'Spravuj nastavení jazyka');

        const setLanguage = new SetLanguage();
        const resetLanguage = new ResetLanguage();

        languageGroup.addSubCommand(setLanguage);
        languageGroup.addSubCommand(resetLanguage);
        this.addSubCommandGroup(languageGroup);

        const defaultGroup = new SubCommandGroup(
            'default',
            'Manage default command arguments'
        );
        defaultGroup.addLocalization(
            Locale.Czech,
            'vychozi',
            'Spravuj výchozí argumenty příkazů'
        );

        const defaultHistory = new DefaultHistory();
        defaultGroup.addSubCommand(defaultHistory);
        this.addSubCommandGroup(defaultGroup);

        this.handlers['language'] = {
            set: setLanguage.handler.bind(setLanguage),
            reset: resetLanguage.handler.bind(resetLanguage)
        };
        this.handlers['default'] = {
            history: defaultHistory.handler.bind(defaultHistory)
        };

        this.events['interactionCreate'] = [this.handleAutocomplete.bind(this)];
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (group && sub && this.handlers[group] && this.handlers[group][sub]) {
            await this.handlers[group][sub](interaction);
        }
    }

    async handleAutocomplete(interaction: Interaction) {
        if (!interaction.isAutocomplete()) return;
        if (interaction.commandName !== 'settings') return;

        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (group === 'default' && sub === 'history') {
            const lang = getLocale(interaction.locale);
            const focused = interaction.options.getFocused(true);
            if (focused.name === 'queue') {
                const value = focused.value.toLowerCase();

                const options = queues
                    .map((queue) => ({
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        name: (lang.queues as any)[queue.queueId] || 'Unknown Queue',
                        value: queue.queueId.toString()
                    }))
                    .filter((opt) => opt.name && opt.name.toLowerCase().includes(value));

                await interaction.respond(options.slice(0, 25));
            }
        }
    }
}

class SetLanguage extends SubCommand {
    constructor() {
        super('set', 'Set your preferred language');
        this.addLocalization(Locale.Czech, 'nastavit', 'Nastav svůj preferovaný jazyk');
        this.addOption({
            type: 'STRING',
            name: 'language',
            localizedName: {
                [Locale.Czech]: 'jazyk'
            },
            description: 'The language to set',
            localizedDescription: {
                [Locale.Czech]: 'Jazyk k nastavení'
            },
            required: true,
            choices: [
                { name: 'English', value: 'en-US' },
                { name: 'Čeština', value: 'cs' }
            ]
        });
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const langString = interaction.options.getString('language', true);
        await userSettings.setLanguage(interaction.user.id, langString);

        const targetLang = getLocale(langString as Locale);
        const langName = langString === 'cs' ? 'Čeština' : 'English';

        const content = replacePlaceholders(targetLang.settings.language.set, langName);

        await interaction.reply({
            content,
            flags: MessageFlags.Ephemeral
        });
    }
}

class ResetLanguage extends SubCommand {
    constructor() {
        super('reset', 'Reset your language to Discord default');
        this.addLocalization(
            Locale.Czech,
            'resetovat',
            'Resetuj nastavení jazyka na výchozí'
        );
    }

    async handler(interaction: ChatInputCommandInteraction) {
        await userSettings.setLanguage(interaction.user.id, null);
        const lang = getLocale(interaction.locale);

        await interaction.reply({
            content: lang.settings.language.reset,
            flags: MessageFlags.Ephemeral
        });
    }
}

class DefaultHistory extends SubCommand {
    constructor() {
        super('history', 'Set default options for history command');
        this.addLocalization(
            Locale.Czech,
            'historie',
            'Nastav výchozí možnosti pro příkaz historie'
        );
        this.addOption({
            name: 'queue',
            description: 'Default queue filter',
            localizedName: {
                [Locale.Czech]: 'fronta'
            },
            localizedDescription: {
                [Locale.Czech]: 'Výběr fronty pro filtrování'
            },
            type: 'STRING',
            required: false,
            autocomplete: true
        });
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const queue = interaction.options.getString('queue');
        const lang = getLocale(interaction.locale);

        if (queue === null) {
            const userConf = await userSettings.get(interaction.user.id);
            const current = userConf?.command_presets?.history || {};
            await interaction.reply({
                content: replacePlaceholders(
                    lang.settings.defaults.current,
                    'history',
                    JSON.stringify(current, null, 2)
                ),
                flags: MessageFlags.Ephemeral
            });
            return;
        }

        await userSettings.setDefaults(interaction.user.id, 'history', { queue });

        await interaction.reply({
            content: replacePlaceholders(
                lang.settings.defaults.updated,
                'history',
                `Queue: ${queue}`
            ),
            flags: MessageFlags.Ephemeral
        });
    }
}
