// Reveal beats in ms after the reveal phase starts. The host screen and the
// phones read the same numbers: the points give the answer away (200 for
// voting with the room, 100 for being named), so a phone's result card and
// the gains on any leaderboard wait until the room's pick has landed.
export const REVEAL = {
  drum: 1100, // drumroll, then the room's pick slams in
  card: 1450, // phone result card (phones only, see below)
  bars: 1400, // vote bars start growing
  board: 2200, // leaderboard with this round's gains
} as const;

// Why the phone card waits 350ms past the pick: each screen times its reveal
// from when the phase reached it, so a phone can start a little ahead of the
// laptop.  The pick's slam takes about 35ms to show, while a phone with Reduce
// Motion shows its card at once, so 350ms keeps the card at least 250ms behind
// the host's pick on every phone.  The phone's board (2200) still comes after
// the card.
