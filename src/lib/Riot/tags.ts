import { getLocale } from '$/lib/langs';
import { MatchSchema, MatchTimelineSchema, ParticipantSchema } from '$/lib/Riot/schemes';
import type { PlayerTagInput } from '$/types/worker/PlayerTagInput';
import type { Locale } from 'discord.js';
import type { z } from 'zod';

type MatchData = z.infer<typeof MatchSchema>;
type MatchTimelineData = z.infer<typeof MatchTimelineSchema>;
type Participant = z.infer<typeof ParticipantSchema>;

export const evaluatePlayerTags = (
    participant: Participant,
    match: MatchData,
    timeline: MatchTimelineData | null,
    locale: Locale | string
): PlayerTagInput[] => {
    const lang = getLocale(locale as Locale);
    const info = match.info;
    const allParticipants = info.participants as Participant[];

    const teamParticipants = allParticipants.filter(
        (p) => p.teamId === participant.teamId
    );
    const teamTotalDamage = teamParticipants.reduce(
        (sum, p) => sum + p.totalDamageDealtToChampions,
        0
    );
    const teamTotalKills = teamParticipants.reduce((sum, p) => sum + p.kills, 0);

    let hadEarlyKill = false;
    let isFirstBlood = false;
    let controlWardsPlaced = 0;

    if (timeline && timeline.info) {
        const timelineParticipant = timeline.info.participants.find(
            (p) => p.puuid === participant.puuid
        );
        const participantId = timelineParticipant?.participantId;

        let firstKillRecorded = false;

        if (participantId !== undefined) {
            for (const frame of timeline.info.frames) {
                for (const event of frame.events) {
                    if (event.type === 'CHAMPION_KILL') {
                        if (!firstKillRecorded) {
                            firstKillRecorded = true;
                            if (event.killerId === participantId) {
                                isFirstBlood = true;
                            }
                        }
                        if (
                            event.killerId === participantId &&
                            event.timestamp < 300_000
                        ) {
                            hadEarlyKill = true;
                        }
                    } else if (
                        event.creatorId === participantId &&
                        event.type === 'WARD_PLACED' &&
                        event.wardType === 'CONTROL_WARD'
                    ) {
                        controlWardsPlaced++;
                    }
                }
            }
        }
    }

    const highestDmg = Math.max(
        ...allParticipants.map((p) => p.totalDamageDealtToChampions)
    );
    const highestVision = Math.max(...allParticipants.map((p) => p.visionScore));
    const highestKills = Math.max(...allParticipants.map((p) => p.kills));
    const highestAssists = Math.max(...allParticipants.map((p) => p.assists));
    const highestDamageTaken = Math.max(
        ...allParticipants.map((p) => p.totalDamageTaken ?? 0)
    );

    const durationMinutes = info.gameDuration > 0 ? info.gameDuration / 60 : 1;
    const totalCs =
        participant.totalMinionsKilled + (participant.neutralMinionsKilled ?? 0);
    const csPerMin = totalCs / durationMinutes;
    const killParticipation =
        teamTotalKills > 0
            ? ((participant.kills + participant.assists) / teamTotalKills) * 100
            : 0;
    const kdaRatio =
        participant.deaths === 0
            ? participant.kills + participant.assists
            : (participant.kills + participant.assists) / participant.deaths;
    const teamDamagePct =
        teamTotalDamage > 0
            ? (participant.totalDamageDealtToChampions / teamTotalDamage) * 100
            : 0;

    const evaluatedTags: PlayerTagInput[] = [];

    if (hadEarlyKill) {
        evaluatedTags.push({
            id: 'earlyKiller',
            name: lang.reportTags.earlyKiller,
            color: '#FF4655'
        });
    }
    if (isFirstBlood) {
        evaluatedTags.push({
            id: 'firstBlood',
            name: lang.reportTags.firstBlood,
            color: '#E60000'
        });
    }
    if (participant.totalDamageDealtToChampions >= highestDmg && teamDamagePct >= 30) {
        evaluatedTags.push({
            id: 'damageMonster',
            name: lang.reportTags.damageMonster,
            color: '#FF5722'
        });
    }
    if (participant.kills >= highestKills && participant.kills >= 8) {
        evaluatedTags.push({
            id: 'killLeader',
            name: lang.reportTags.killLeader,
            color: '#E040FB'
        });
    }
    if ((participant.largestMultiKill ?? 0) >= 3) {
        evaluatedTags.push({
            id: 'bountyHunter',
            name: lang.reportTags.bountyHunter,
            color: '#FFD700'
        });
    }
    if (participant.kills >= 10 && participant.deaths <= 2) {
        evaluatedTags.push({
            id: 'assassin',
            name: lang.reportTags.assassin,
            color: '#B388FF'
        });
    }
    if (participant.deaths === 0 && info.gameDuration >= 900) {
        evaluatedTags.push({
            id: 'unkillable',
            name: lang.reportTags.unkillable,
            color: '#00E5FF'
        });
    }
    if (
        (participant.totalDamageTaken ?? 0) >= highestDamageTaken &&
        participant.deaths <= 4 &&
        (participant.totalDamageTaken ?? 0) >= 20_000
    ) {
        evaluatedTags.push({
            id: 'ironWall',
            name: lang.reportTags.ironWall,
            color: '#78909C'
        });
    }
    if (killParticipation >= 70 && teamTotalKills >= 5) {
        evaluatedTags.push({
            id: 'teamAnchor',
            name: lang.reportTags.teamAnchor,
            color: '#3D5AFE'
        });
    }
    if (participant.assists >= highestAssists && participant.assists >= 15) {
        evaluatedTags.push({
            id: 'masterAssistant',
            name: lang.reportTags.masterAssistant,
            color: '#80D8FF'
        });
    }
    if (
        kdaRatio >= 8.0 &&
        participant.win &&
        participant.kills + participant.assists >= 10
    ) {
        evaluatedTags.push({
            id: 'clutchPerformer',
            name: lang.reportTags.clutchPerformer,
            color: '#FF80AB'
        });
    }
    if (participant.visionScore >= highestVision && participant.visionScore >= 60) {
        evaluatedTags.push({
            id: 'visionMaster',
            name: lang.reportTags.visionMaster,
            color: '#F0C850'
        });
    }
    if ((participant.wardsKilled ?? 0) >= 8) {
        evaluatedTags.push({
            id: 'wardSweeper',
            name: lang.reportTags.wardSweeper,
            color: '#A7FFEB'
        });
    }
    if (controlWardsPlaced >= 5) {
        evaluatedTags.push({
            id: 'controlWarden',
            name: lang.reportTags.controlWarden,
            color: '#FF5252'
        });
    }
    if (csPerMin >= 8.5) {
        evaluatedTags.push({
            id: 'csMachine',
            name: lang.reportTags.csMachine,
            color: '#00E676'
        });
    }
    if (
        participant.goldEarned >= 15_000 &&
        participant.goldEarned >= Math.max(...allParticipants.map((p) => p.goldEarned))
    ) {
        evaluatedTags.push({
            id: 'goldTycoon',
            name: lang.reportTags.goldTycoon,
            color: '#FFD700'
        });
    }
    if ((participant.dragonKills ?? 0) >= 3) {
        evaluatedTags.push({
            id: 'dragonSlayer',
            name: lang.reportTags.dragonSlayer,
            color: '#FF6D00'
        });
    }

    return evaluatedTags;
};
