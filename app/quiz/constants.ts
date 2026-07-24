export const CHOICE_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
export const CHOICE_SHAPES = ["▲", "◆", "●", "■"];

// Base points for a correct answer + bonus by speed rank among correct answers.
export const BASE_POINTS = 500;
export const SPEED_BONUS = [250, 200, 150, 100, 50];
export const LATE_BONUS = 25; // correct but slower than the top 5

export type QuizResult = {
  player_id: string;
  name: string;
  gained: number;
  correct: boolean;
  choice: number | null;
};
export type QuizPhaseData = {
  counts?: number[];
  results?: QuizResult[];
};
