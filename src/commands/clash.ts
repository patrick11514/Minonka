import { Command } from '$/lib/Command';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { SubCommand } from '$/lib/SubCommand';
import { addRegionOption } from '$/lib/utilities';
import { ChatInputCommandInteraction, Locale, MessageFlags } from 'discord.js';

export default class Clash extends Command {
    private schedule: SubCommand;

    constructor() {
        super('clash', 'Show information about clash');
        super.addLocalization(Locale.Czech, 'clash', 'Zobrazí informace o clashech');

        this.schedule = new SubCommand(
            'schedule',
            'Shows the schedule for upcomming clashes'
        );
        this.schedule.addLocalization(
            Locale.Czech,
            'rozpis',
            'Zobrazí rozpis nadcházejících clashů'
        );
        addRegionOption(this.schedule);
        super.addSubCommand(this.schedule);
    }

    async handler(interaction: ChatInputCommandInteraction) {
        if (this.schedule.match(interaction)) {
            this.getSchedule(interaction);
        }
    }

    private async getSchedule(interaction: ChatInputCommandInteraction) {
        const lang = getLocale(interaction.locale);
        const region = interaction.options.getString('region', true) as Region;
        const schedule = await api[region].clash.tournaments();
        if (!schedule.status) {
            interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, schedule)
            });
            return;
        }

        let message = `# ${lang.clash.title}:\n\n`;

        schedule.data.sort((a, b) => a.id - b.id);

        message += schedule.data
            .map((tournament) => {
                const name = replacePlaceholders(
                    lang.clash.mapInflection[
                        tournament.nameKey as keyof typeof lang.clash.mapInflection
                    ],
                    lang.clash.cup
                );

                const activity = tournament.schedule[0];
                const registration = Math.floor(activity.registrationTime / 1000);
                const start = Math.floor(activity.startTime / 1000);

                return `## ${name} - ${lang.clash.day} ${tournament.nameKeySecondary.split('_')[1]}
**🆔 Id:** ${tournament.id}
**📅 ${lang.clash.registration}:** <t:${registration}:F> (<t:${registration}:R>)
**🏆 ${lang.clash.start}:** <t:${start}:F> (<t:${start}:R>)`;
            })
            .join('\n\n');

        await interaction.reply(message);
    }
}
