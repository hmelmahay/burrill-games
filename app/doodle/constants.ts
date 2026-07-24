export const GUESS_POINTS = [500, 400, 300, 250, 200]; // by order of correct guess
export const LATE_GUESS_POINTS = 150;
export const DRAWER_PER_CORRECT = 150;

export type DoodleRound = { drawer_id: string; drawer_name: string; options: string[] };
export type DoodleResult = {
  player_id: string;
  name: string;
  gained: number;
  correct: boolean;
  isDrawer: boolean;
};
export type DoodlePhaseData = {
  word?: string; // published at reveal
  results?: DoodleResult[];
};
