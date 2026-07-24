export const BASE_POINTS = 500;
export const SPEED_BONUS = [250, 200, 150, 100, 50];
export const LATE_BONUS = 25;

export type EmojiResult = {
  player_id: string;
  name: string;
  gained: number;
  correct: boolean;
  guess: string | null;
};
export type EmojiPhaseData = {
  results?: EmojiResult[];
};
