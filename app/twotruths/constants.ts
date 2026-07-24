export const VOTER_POINTS = 500; // spotted the lie
export const AUTHOR_POINTS_PER_FOOL = 250;

export type TTRound = { author_id: string; author_name: string };
export type TTResult = {
  player_id: string;
  name: string;
  gained: number;
  vote: number | null; // null for the author or non-voters
  correct: boolean;
};
export type TTPhaseData = {
  statements?: string[]; // published by the host when voting opens (lie index withheld)
  lie?: number; // published at reveal
  results?: TTResult[];
};
