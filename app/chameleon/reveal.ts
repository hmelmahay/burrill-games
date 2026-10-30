import type { Tone } from "@/lib/fx";
import type { ChamPhaseData } from "@/app/chameleon/constants";

// Reveal timing for Chameleon, in ms from the moment the reveal starts. The
// host screen and the phones read the same numbers, so a phone never shows
// its result or the scores before the outcome lands on the big screen (the
// 2/1/2 gains would give it away).
export const REVEAL = {
  drum: 1100, // the teaser runs, then the outcome card slams in
  grid: 1300, // the secret word flips over; a wrong pick gets its ✕
  card: 1300, // phone: the player's own result card
  bars: 1500, // host: who got the votes
  board: 2200, // leaderboard with this round's gains
} as const;

// The teaser the Drumroll shows before the outcome card lands.
export function revealTease(caught?: boolean): string {
  return caught ? "🤞 Did they guess it?" : "🦎 The Chameleon was…";
}

// The outcome card's stamp. Busted is green because the room won it.
export function outcomeStamp(data: ChamPhaseData, secretIdx: number): { label: string; tone: Tone } {
  if (!data.caught) return { label: "Escaped", tone: "pink" };
  if (data.guess_idx != null && data.guess_idx === secretIdx) return { label: "Guessed it", tone: "gold" };
  return { label: "Busted", tone: "win" };
}
