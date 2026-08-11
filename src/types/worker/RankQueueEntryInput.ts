import type { StreakInput } from "./StreakInput";

export type RankQueueEntryInput = { queueType: string, wins: number, losses: number, tier: string, rank: string, leaguePoints: number, streak?: StreakInput, };

