import type { CSSProperties } from "react";

// Vibe Check's reveal rhythm, in ms from the moment the reveal phase opens.
// The host, TV copies and phones all read these numbers.
//
// Each screen times its reveal from when the phase change reaches it, so a
// phone can start a little ahead of the host.  The phone's own result card
// waits 250ms past the host's Bullseye beat, and the phone's board moves back
// with it, still 200ms after the card.
export const REVEAL = {
  target: 300, // the green target line drops; the scoring bands spread out from it
  marks: 800, // dials pop in, farthest from the target first
  bullseye: 1600, // rings on dials within BULLSEYE, the stamp and confetti (the host's payoff)
  board: 1800, // host:  the leaderboard
  phoneCard: 1850, // phone:  the player's own result card
  phoneBoard: 2050, // phone:  the leaderboard, after the card
} as const;

export const BAND_STEP = 60; // the scoring bands spread out from the target this far apart
export const MARK_STEP = 90; // dials pop this far apart...
export const MARK_MAX = 700; // ...all of them started within this long
export const TARGET_COUNT_MS = 800; // phone: the target number counts up from 0

// Scoring bands drawn around the target, widest first. They mirror
// pointsForDistance in constants.ts (100 / 250 / 400 / 500 points), and the
// innermost one is the bullseye.
export const BANDS = [35, 20, 10, 5] as const;
export const BULLSEYE = 5;

// Put this on each reveal block, around the podium and on the Dial. Slams and
// stamps wait for their delay at up to 2x size (invisible), and a ring on a
// dial at either end reaches past the dial; on a phone either one widens the
// page (a result card measured 496px wide on a 375px screen). This clips
// sideways at the screen edge (the Shell's 1rem padding), so nothing visible
// changes and nothing scrolls. Engines without `clip` ignore it.
export const EDGE_CLIP: CSSProperties = {
  overflowX: "clip",
  marginLeft: "-1rem",
  marginRight: "-1rem",
  paddingLeft: "1rem",
  paddingRight: "1rem",
};
