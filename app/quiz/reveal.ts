import type { QuizResult } from "./constants";

// Reveal beats in ms after the reveal phase starts. The host, the phones and
// the stage all read these, so the payoff lands together on every screen.
// The right answer itself shows at 0 everywhere.
export const REVEAL = { bars: 200, fastest: 600, board: 600 } as const;

// pointsForElapsed is monotonic in speed, so the biggest gain among correct
// answers belongs to the fastest correct player. Null when nobody was right.
export function fastestCorrect(results: QuizResult[] | undefined): QuizResult | null {
  const correct = (results ?? []).filter((r) => r.correct);
  if (correct.length === 0) return null;
  return correct.reduce((a, b) => (b.gained > a.gained ? b : a));
}
