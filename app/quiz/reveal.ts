import type { QuizResult } from "./constants";

// Reveal beats in ms after the reveal phase starts.  The host, the phones and
// the stage all read these, so the payoff lands together on every screen.
// The right answer itself shows at 0 on the host and the stage.
//
// Each screen times its reveal from when the phase change reaches it, so a
// phone can start a little ahead of the host.  The phone's own result card
// waits 250ms so it never lands before the host shows the right answer, and
// the phone's board stays at or after the card.
export const REVEAL = {
  bars: 200, // host and stage: the vote bars start growing
  card: 250, // phone: the player's own result card
  fastest: 600, // the Fastest callout, and the fastest player's confetti
  board: 600, // leaderboard with this round's gains
} as const;

// pointsForElapsed is monotonic in speed, so the biggest gain among correct
// answers belongs to the fastest correct player. Null when nobody was right.
export function fastestCorrect(results: QuizResult[] | undefined): QuizResult | null {
  const correct = (results ?? []).filter((r) => r.correct);
  if (correct.length === 0) return null;
  return correct.reduce((a, b) => (b.gained > a.gained ? b : a));
}
