export const CHOICE_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];
export const CHOICE_LETTERS = ["A", "B", "C", "D"];

// Hints mode: which wrong choices are struck out as time winds down — one at
// half time, a second at quarter time. Pure function of (round, time) so every
// phone, host, and TV agrees without any coordination.
export function eliminatedChoices(
  roundIdx: number,
  answer: number,
  secondsLeft: number,
  totalSeconds: number,
): number[] {
  const wrong = [0, 1, 2, 3].filter((i) => i !== answer);
  const out: number[] = [];
  if (secondsLeft <= Math.ceil(totalSeconds / 2)) out.push(wrong[roundIdx % 3]);
  if (secondsLeft <= Math.ceil(totalSeconds / 4)) out.push(wrong[(roundIdx + 1) % 3]);
  return out;
}

export type QuizSettings = {
  numQuestions?: number;
  answerSeconds?: number;
  hints?: boolean;
  allowChange?: boolean;
};

// Base points for a correct answer + bonus by speed rank among correct answers.
// Time-based scoring, exact to the point: an instant correct answer is worth
// ~1000, sliding down to 500 at the buzzer. Elapsed time uses server
// timestamps only (question start stamped by a DB trigger, answers by insert
// time), so phone clocks can't skew it.
export const CORRECT_MIN = 500;
export const SPEED_MAX = 500;
export function pointsForElapsed(elapsedMs: number, answerSeconds: number): number {
  const frac = Math.max(0, 1 - elapsedMs / (answerSeconds * 1000));
  return CORRECT_MIN + Math.round(SPEED_MAX * frac);
} // correct but slower than the top 5

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
