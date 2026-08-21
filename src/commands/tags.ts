import { Command } from '$/lib/Command';
import { getLocale } from '$/lib/langs';
import { ChatInputCommandInteraction, Locale, MessageFlags } from 'discord.js';

const TAG_KEYS = [
    'earlyKiller',
    'firstBlood',
    'damageMonster',
    'killLeader',
    'bountyHunter',
    'assassin',
    'unkillable',
    'ironWall',
    'teamAnchor',
    'masterAssistant',
    'clutchPerformer',
    'visionMaster',
    'wardSweeper',
    'controlWarden',
    'csMachine',
    'goldTycoon',
    'dragonSlayer'
] as const;

export default class Tags extends Command {
    constructor() {
        super('tags', 'List all match performance tags and their requirements', {
            exampleUsage: {
                default: '/tags - Displays a list of all player performance badges',
                locales: {
                    [Locale.Czech]: '/tagy - Zobrazí seznam všech herních odznaků'
                }
            }
        });

        super.addLocalization(
            Locale.Czech,
            'tagy',
            'Zobrazí seznam všech herních odznaků a podmínky pro jejich získání'
        );
    }

    async handler(interaction: ChatInputCommandInteraction) {
        const lang = getLocale(interaction.locale);

        const lines = TAG_KEYS.map((key) => {
            const name = lang.reportTags[key];
            const desc = lang.reportTagDescriptions[key];
            return `• **${name}** – ${desc}`;
        });

        const content = `### ${lang.tagsCommand.title}\n${lang.tagsCommand.description}\n\n${lines.join('\n')}`;

        await interaction.reply({
            content,
            flags: MessageFlags.Ephemeral
        });
    }
}
