import { AccountCommandGroup } from '$/lib/AccountCommandGroup';
import { Command } from '$/lib/Command';
import { getLocale, replacePlaceholders } from '$/lib/langs';
import Logger from '$/lib/logger';
import api from '$/lib/Riot/api';
import { formatErrorResponse } from '$/lib/Riot/baseRequest';
import { Region } from '$/lib/Riot/types';
import { SubCommand } from '$/lib/SubCommand';
import { addRegionOption, getHighestRank } from '$/lib/utilities';
import { Account } from '$/types/database';
import { TeamData } from '$/Worker/tasks/team';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    CacheType,
    ChatInputCommandInteraction,
    Locale,
    MessageFlags,
    RepliableInteraction
} from 'discord.js';
import { Selectable } from 'kysely';
import fs from 'node:fs/promises';

const l = new Logger('Clash', 'green');

export default class Clash extends Command {
    private schedule: SubCommand;
    private team: AccountCommandGroup;
    private teamId: SubCommand;

    constructor() {
        super('clash', 'Show information about clash', {
            exampleUsage: {
                default: `- /clash schedule - Shows the schedule for upcoming clashes
- /clash team me - Shows clash team by user
- /clash team id id:456 region:EUNE - Shows clash team by id`,
                locales: {
                    [Locale.Czech]: `- /clash rozpis - Zobrazí rozpis nadcházejících clashů
- /clash tým já - Zobrazí clash tým podle uživatele
- /clash tým id id:456 region:EUNE - Zobrazí clash tým podle id`
                }
            },
            extendedHelp: {
                default: `This command is used to show information about clash. You can use it to get the schedule for upcomming clashes or to get information about your/other players clash team.`,
                locales: {
                    [Locale.Czech]: `Tento příkaz se používá k zobrazení informací o clashi. Můžeš jej použít k získání rozpisu nadcházejících clashů nebo k získání informací o tvém/ostatních hráčských clash týmu.`
                }
            }
        });
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

        this.team = new AccountCommandGroup(
            'team',
            'Show clash team and their members',
            {
                me: {
                    description: 'Show clash team by user',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí clash tým podle uživatele'
                    }
                },
                name: {
                    description: 'Show clash team by name',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí clash tým podle jména'
                    }
                },
                mention: {
                    description: 'Show clash team by mention',
                    localizedDescription: {
                        [Locale.Czech]: 'Zobrazí clash tým podle zmínky'
                    }
                }
            },
            this.getUserTeams.bind(this)
        );
        super.addSubCommandGroup(this.team);

        this.teamId = new SubCommand('id', 'Show clash team by id');
        this.teamId.addLocalization(Locale.Czech, 'id', 'Zobrazí clash tým podle id');
        this.teamId.addOption({
            type: 'STRING',
            name: 'team_id',
            localizedName: {
                [Locale.Czech]: 'id_tymu'
            },
            description: 'Clash team id',
            localizedDescription: {
                [Locale.Czech]: 'Id clash týmu'
            },
            required: true
        });
        addRegionOption(this.teamId);
        this.team.addSubCommand(this.teamId);

        //We need to register handler for the team menu
        super.on('interactionCreate', this.team.menuHandle);
    }

    async handler(interaction: ChatInputCommandInteraction) {
        if (this.schedule.match(interaction)) {
            await this.getSchedule(interaction);
        } else if (this.team.match(interaction)) {
            if (this.teamId.match(interaction)) {
                const option = interaction.options.getString('team_id', true);
                const region = interaction.options.getString('region', true) as Region;
                await this.handleTeam(interaction, option, region);
            } else {
                await this.team.handleAccountCommand(interaction, l);
            }
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

                return `## ${activity.cancelled ? '~~' : ''}${name} - ${lang.clash.day} ${tournament.nameKeySecondary.split('_')[1]} ${activity.cancelled ? `~~ (${lang.clash.canceled})` : ''}
**🆔 Id:** ${tournament.id}
**📅 ${lang.clash.registration}:** <t:${registration}:F> (<t:${registration}:R>)
**🏆 ${lang.clash.start}:** <t:${start}:F> (<t:${start}:R>)`;
            })
            .join('\n\n');

        await interaction.reply(message);
    }

    private async getUserTeams(
        interaction: RepliableInteraction<CacheType>,
        account: Selectable<Account>,
        region: Region
    ) {
        const team = await api[region].clash.players(account.puuid);
        if (!team.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(getLocale(interaction.locale), team)
            });
            return;
        }

        if (team.data.length === 0) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: getLocale(interaction.locale).clash.noTeam
            });
            return;
        }

        this.handleTeam(interaction, team.data[0].teamId, region);
    }

    private async handleTeam(
        interaction: RepliableInteraction<CacheType>,
        teamId: string,
        region: Region
    ) {
        const lang = getLocale(interaction.locale);

        const team = await api[region].clash.team(teamId);
        if (!team.status) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: formatErrorResponse(lang, team)
            });
            return;
        }

        let newPlayers: TeamData['players'];

        try {
            newPlayers = await Promise.all(
                team.data.players.map(async (player) => {
                    const summoner = await api[region].summoner.byPuuid(player.puuid);
                    if (!summoner.status) {
                        throw new Error(formatErrorResponse(lang, summoner));
                    }

                    const account = await api[region].account.byPuuid(player.puuid);
                    if (!account.status) {
                        throw new Error(formatErrorResponse(lang, account));
                    }

                    const rank = await getHighestRank(summoner.data.puuid, region, lang);

                    const masteries = await api[region].mastery.top(
                        summoner.data.puuid,
                        5
                    );
                    if (!masteries.status) {
                        throw new Error(formatErrorResponse(lang, masteries));
                    }

                    return {
                        puuid: player.puuid,
                        position: player.position,
                        role: player.role,
                        profileIconId: summoner.data.profileIconId,
                        level: summoner.data.summonerLevel,
                        highestRank: rank,
                        gameName: account.data.gameName,
                        tagLine: account.data.tagLine,
                        masteries: masteries.data
                    } satisfies TeamData['players'][number];
                })
            );
        } catch (e) {
            await interaction.reply({
                flags: MessageFlags.Ephemeral,
                content: (e as Error).message
            });
            return;
        }

        await interaction.deferReply();

        try {
            const result = await process.workerServer.addJobWait('team', {
                ...team.data,
                players: newPlayers,
                locale: interaction.locale
            });

            const rankRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                newPlayers.map((player) =>
                    new ButtonBuilder()
                        .setLabel(`Rank: ${player.gameName}#${player.tagLine}`)
                        .setCustomId(`clrank;${player.puuid};${region}`)
                        .setStyle(ButtonStyle.Primary)
                )
            );

            const clashHistoryRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                newPlayers.map((player) =>
                    new ButtonBuilder()
                        .setLabel(`History: ${player.gameName}#${player.tagLine}`)
                        .setCustomId(`clhis;${player.puuid};${region}`)
                        .setStyle(ButtonStyle.Secondary)
                )
            );

            await interaction.editReply({
                content: replacePlaceholders(lang.clash.successMessage, team.data.id),
                files: [result],
                components: [rankRow, clashHistoryRow]
            });

            await fs.unlink(result);
        } catch (e) {
            if (e instanceof Error) {
                l.error(e);
                await interaction.editReply({
                    content: replacePlaceholders(
                        getLocale(interaction.locale).workerError,
                        e.message
                    )
                });
                return;
            }

            await interaction.editReply({
                content: getLocale(interaction.locale).genericError
            });
            return;
        }
    }
}
