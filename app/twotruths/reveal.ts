// Reveal timing for Two Truths & a Lie, in ms from the moment the reveal
// starts. The host screen and the phones read the same numbers, so a phone
// never shows its result or the scores before the lie lands on the big screen
// (the 500/250 gains would give the answer away).
export const REVEAL = {
  truth1: 500, // first truth, in statement order, gets its TRUE stamp
  truth2: 1100, // second truth
  lie: 1900, // the lie: red overlay, big stamp, shake
  fooled: 2100, // host: the author's "Fooled n" stamp
  card: 2100, // phone: the player's own result card
  board: 2300, // leaderboard with this round's gains
} as const;

// When each statement's verdict lands: the truths first, in statement order,
// and the lie last.
export function verdictTimes(count: number, lie?: number | null): number[] {
  let truths = 0;
  return Array.from({ length: count }, (_, i) =>
    i === lie ? REVEAL.lie : truths++ === 0 ? REVEAL.truth1 : REVEAL.truth2,
  );
}
