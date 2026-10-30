// Reveal beats in ms after the reveal phase starts. The host screen and the
// phones read the same numbers, so a phone's result card and the gains on any
// leaderboard never land before the host's verdict.
export const REVEAL = {
  verdict: 900, // the split bar settles and the "Majority: X" stamp lands
  voters: 1100, // who voted which way: player dots pop 50ms apart
  card: 1250, // phone result card (phones only, see below)
  board: 1400, // leaderboard with this round's gains
} as const;

// Why the phone card waits 350ms past the verdict: each screen times its
// reveal from when the phase reached it, so a phone can start a little ahead
// of the laptop.  The stamp also takes about 80ms to show, while a phone with
// Reduce Motion shows its card at once, so 350ms keeps the card at least 250ms
// behind the host's stamp on every phone.  The phone's board (1400) still
// comes after the card.
