// Reveal timing for Two Truths & a Lie, in ms from the moment the reveal
// starts.  The host screen and the phones play the same verdicts, and nothing
// that gives the answer away (the 500/250 gains) shows before the lie lands.
//
// Each screen times its reveal from when the phase change reaches it, so a
// phone can start a little ahead of the host (QA saw up to about 0.3s when a
// phone's 5s backstop poll beat Realtime).  So the phone's own card waits
// until 400ms after the host's lie, and the phone's board follows the card.
export const REVEAL = {
  truth1: 500, // first truth, in statement order, gets its TRUE stamp
  truth2: 1100, // second truth
  lie: 1900, // the lie:  red overlay, big stamp, shake (the host's payoff)
  fooled: 2100, // host:  the author's "Fooled n" stamp
  board: 2300, // host:  leaderboard with this round's gains
  phoneCard: 2300, // phone:  the player's own result card
  phoneBoard: 2500, // phone:  leaderboard with this round's gains
} as const;

// When each statement's verdict lands: the truths first, in statement order,
// and the lie last.
export function verdictTimes(count: number, lie?: number | null): number[] {
  let truths = 0;
  return Array.from({ length: count }, (_, i) =>
    i === lie ? REVEAL.lie : truths++ === 0 ? REVEAL.truth1 : REVEAL.truth2,
  );
}
