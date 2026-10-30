import type { DoodleResult } from "./constants";

// Reveal timings in ms.  The host screen and the phones both read these, so a
// phone's result card never lands before the host shows the word.
export const REVEAL = { word: 200, royalties: 500, first: 650, board: 800 } as const;

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
