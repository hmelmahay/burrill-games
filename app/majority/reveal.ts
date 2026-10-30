// Reveal beats in ms after the reveal phase starts. The host screen and the
// phones read the same numbers, so a phone's result card and the gains on any
// leaderboard never land before the host's verdict.
export const REVEAL = {
  verdict: 900, // the split bar settles, the "Majority: X" stamp lands, phones get their result
  voters: 1100, // who voted which way: player dots pop 50ms apart
  board: 1400, // leaderboard with this round's gains
} as const;
