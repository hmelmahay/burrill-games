import type { CSSProperties } from "react";

// Ballpark's reveal rhythm, in ms from the moment the reveal phase opens.  The
// host, TV copies and phones all read these numbers.
//
// Each screen times its reveal from when the phase change reaches it, so a
// phone can start a little ahead of the host.  The phone's own result card
// waits 250ms past the host's flag, and the phone's board moves back with it,
// still 400ms after the card.
export const REVEAL = {
  flag: 1500, // the answer count-up ends and the gold flag slams onto the line (the host's payoff)
  ring: 1600, // the closest pins ring
  deadOn: 1700, // an exact hit:  the Dead on stamp and confetti
  board: 1900, // host:  the sorted guesses and the leaderboard
  phoneCard: 1750, // phone:  the player's own result card
  phoneBoard: 2150, // phone:  the leaderboard, after the card
} as const;

// Pins drop farthest first, this far apart, all of them started within PIN_MAX.
export const PIN_STEP = 120;
export const PIN_MAX = 1200;

// Put this on each reveal block and around the podium. Slams and stamps wait
// for their delay at up to 2x size (invisible), and on a phone that oversized
// box widens the page: a result card measured 496px wide on a 375px screen.
// This clips sideways at the screen edge (the Shell's 1rem padding), so
// nothing visible changes and nothing scrolls. Engines without `clip` ignore it.
export const EDGE_CLIP: CSSProperties = {
  overflowX: "clip",
  marginLeft: "-1rem",
  marginRight: "-1rem",
  paddingLeft: "1rem",
  paddingRight: "1rem",
};
