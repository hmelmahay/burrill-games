import type { Tone } from "@/lib/fx";
import type { ChamPhaseData } from "@/app/chameleon/constants";

// Reveal timing for Chameleon, in ms from the moment the reveal starts.  The
// host screen and the phones play the same drumroll and grid, and nothing that
// gives the outcome away (the 2/1/2 gains) shows before the outcome card lands.
//
// Each screen times its reveal from when the phase change reaches it, so a
// phone can start a little ahead of the host (QA saw up to about 0.3s when a
// phone's 5s backstop poll beat Realtime).  So the phone's own card waits
// until 400ms after the host's outcome card, and the phone's board and the
// line under it follow the card.
export const REVEAL = {
  drum: 1100, // the teaser runs, then the outcome card slams in (the host's payoff)
  grid: 1300, // the secret word flips over; a wrong pick gets its ✕
  bars: 1500, // host:  who got the votes
  board: 2200, // host:  leaderboard with this round's gains
  phoneCard: 1500, // phone:  the player's own result card
  phoneBoard: 2400, // phone:  leaderboard with this round's gains, and the line under it
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
