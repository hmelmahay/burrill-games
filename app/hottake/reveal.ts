// Reveal beats in ms after the reveal phase starts. The host screen and the
// phones read the same numbers: the points give the answer away (200 for
// voting with the room, 100 for being named), so a phone's result card and
// the gains on any leaderboard wait until the room's pick has landed.
export const REVEAL = {
  drum: 1100, // drumroll, then the room's pick slams in
  card: 1300, // phone result card
  bars: 1400, // vote bars start growing
  board: 2200, // leaderboard with this round's gains
} as const;
