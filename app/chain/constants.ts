// Chain Gang: shared types and pure helpers (no imports with side effects, so
// lib/chains.test.ts can run them without a database or build step).
// Relative import with extension (not "@/lib/…") so lib/chains.test.ts can
// run this file under plain node with type stripping — no alias resolution.
import { guessMatches } from "../../lib/matching.ts";

export type ChainMode = "race" | "duel";

export type ChainSettings = {
  mode: ChainMode;
  numChains: number;
  raceSeconds: number;
};

// Race: each player's progress lives in their own arcade_subs payload.
export type RaceProgress = {
  solved: number; // words solved beyond the first (0..9)
  score: number; // word points banked so far this chain
  hints: number; // extra letters bought (for the reveal detail line)
  done: boolean;
};

// Duel: the shared board state, written only by the active player's device.
export type DuelState = {
  solved: number; // words solved beyond the first (0..9); target = words[solved+1]
  reveal: number; // letters showing on the target word (first letter is free)
  turn: string; // player_id whose guess it is
  last: { name: string; word: string; kind: "hit" | "miss" | "given" } | null;
};

export type ChainResult = { player_id: string; name: string; gained: number; detail?: string };

export type ChainPhaseData = {
  duel?: DuelState;
  results?: ChainResult[];
  winner?: string | null; // race: name of the first finisher, if anyone finished
};

export const CHAIN_LEN = 10;
export const HIDDEN_WORDS = CHAIN_LEN - 1; // word 1 is given
export const WORD_MAX = 10; // full value of an unhinted word
export const HINT_COST = 2; // each extra letter knocks this off
export const WORD_MIN = 2; // a word never pays less than this (unless fully shown)
export const RACE_WIN_BONUS = 25; // first player to finish the chain

// What a word pays with `revealed` letters showing. Fully revealed = given away.
export function wordValue(revealed: number, len: number): number {
  if (revealed >= len) return 0;
  return Math.max(WORD_MIN, WORD_MAX - HINT_COST * (revealed - 1));
}

// "W _ _ _" — revealed letters then one slot per hidden letter.
export function maskWord(word: string, revealed: number): string {
  const shown = Math.min(revealed, word.length);
  return (word.slice(0, shown) + "·".repeat(word.length - shown)).split("").join(" ");
}

// Forgiving match, but the typo tolerance is length-aware (lib/matching) and
// the blank count already tells players the exact length.
export function chainGuessOk(guess: string, word: string): boolean {
  return guessMatches(guess, word);
}

// Duel turn order: alternate who opens each chain.
export function duelOpener(playerIds: string[], chainIdx: number): string {
  return playerIds[chainIdx % playerIds.length];
}
