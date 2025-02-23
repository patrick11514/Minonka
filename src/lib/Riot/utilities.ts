import { z } from 'zod';
import { MatchSchema } from './schemes';

export enum MatchStatus {
    Win,
    Loss,
    Remake
}

export const getMatchStatus = (
    match: z.infer<typeof MatchSchema>,
    meSummonerId: string
) => {
    if (match.info.participants[0].gameEndedInEarlySurrender) {
        return MatchStatus.Remake;
    }

    const meParticipant = match.info.participants.find(
        (p) => p.summonerId === meSummonerId
    );
    if (!meParticipant) {
        throw new Error('Participant not found');
    }

    const meTeam = match.info.teams.find((t) => t.teamId === meParticipant.teamId);
    if (!meTeam) {
        throw new Error('Team not found');
    }

    return meTeam.win ? MatchStatus.Win : MatchStatus.Loss;
};
