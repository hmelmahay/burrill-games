import type { DoodleResult } from "./constants";

// Reveal timings in ms.  The host screen and the phones both read these.
// - word, royalties, first, board:  the host's beats.  Phones show the word on
//   the same beat.
// - card:  the phone's own result.  Each screen times its reveal from its own
//   network arrival, so the card keeps 250ms or more of slack after the host's
//   ⚡ First stamp shows.  The stamp needs about 80ms to show, and a
//   reduced-motion card shows at once, so the card waits 350ms past the beat.
//   The first guesser's +500 and confetti never land before the room sees who
//   was first.
// - phoneBoard:  the phone's leaderboard, after its card, because its gains
//   give the same thing away.
export const REVEAL = {
  word: 200,
  royalties: 500,
  first: 650,
  board: 800,
  card: 1000,
  phoneBoard: 1150,
} as const;

// The first correct guesser:  the most points among correct guesses (points
// go by order of getting it right).  Undefined when nobody got it.
export function firstGuesser(results: DoodleResult[]): DoodleResult | undefined {
  let best: DoodleResult | undefined;
  for (const r of results) {
    if (r.isDrawer || !r.correct || r.gained <= 0) continue;
    if (!best || r.gained > best.gained) best = r;
  }
  return best;
}

// What the artist earned this round (150 per correct guess).
export function royaltiesOf(results: DoodleResult[]): number {
  return results.find((r) => r.isDrawer)?.gained ?? 0;
}
