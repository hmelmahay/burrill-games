// Letter Rip: shared types and pure helpers (no side-effect imports, so
// lib/letterrip.test.ts can run them without a database or build step).
// Relative import with extension (not "@/lib/…") so the test can run this
// file under plain node with type stripping — no alias resolution.
import { guessMatches, normalizeGuess } from "../../lib/matching.ts";
import type { LetterRound } from "../../lib/supabase.ts";

export type LetterMode = "race" | "teams" | "coop";

export type LetterSettings = {
  mode: LetterMode;
  numBoards: number;
  boardSeconds: number; // solve clock per board
  stealSeconds: number; // teams: the other side's steal window
};

export const BOARD_ANSWERS = 6;
export const MAX_BOARDS = 10;

// Bottom of the board is written harder, so it pays more.
export const SLOT_POINTS = [10, 10, 15, 15, 20, 20];
export const slotPoints = (i: number) => SLOT_POINTS[i] ?? 10;

// One guess as stored in the player's arcade_subs payload. `t` is the phone's
// clock — good enough to order claims in a party game; ties break on id.
export type LetterGuess = { g: string; t: number; ph: "solve" | "steal" };
export type GuessPayload = { guesses: LetterGuess[] };

export type Claim = { player_id: string; ph: "solve" | "steal" };
export type NamedClaim = Claim & { name: string };

export type LetterResult = { player_id: string; name: string; gained: number; detail?: string };

// Coop keeps a running total across boards (carried forward in phase_data).
export type CoopTally = { answers: number; boards: number };

export type LetterPhaseData = {
  results?: LetterResult[];
  found?: (NamedClaim | null)[];
  cleared?: boolean; // this board was fully cleared before time
  tally?: CoopTally;
};

// --- masking -------------------------------------------------------------

export type Cell = { ch: string; shown: boolean };

// Board display: first letter of the answer shows, every other letter is a
// blank; spaces split words and punctuation stays visible ("T·· G··").
export function maskCells(answer: string): Cell[][] {
  let first = true;
  return answer
    .toUpperCase()
    .split(" ")
    .map((word) =>
      word.split("").map((ch) => {
        if (!/[A-Z0-9]/.test(ch)) return { ch, shown: true };
        if (first) {
          first = false;
          return { ch, shown: true };
        }
        return { ch, shown: false };
      }),
    );
}

// --- claims --------------------------------------------------------------

// Which unfound answer does this guess hit? Exact (normalized) matches win
// before fuzzy ones, so on a board with BASEBALL and BASKETBALL a correctly
// typed "baseball" can never be swallowed by the typo tolerance of its
// look-alike neighbour.
export function matchIdx(
  guess: string,
  round: LetterRound,
  found: readonly (unknown | null)[],
): number {
  const g = normalizeGuess(guess);
  if (!g) return -1;
  const exact = round.answers.findIndex(
    (a, i) =>
      !found[i] && [a.a, ...(a.alts ?? [])].some((t) => normalizeGuess(t) === g),
  );
  if (exact >= 0) return exact;
  // An exact hit on an already-found answer is a duplicate, not license to
  // fuzzy-claim a look-alike neighbour ("baseball" must never take
  // BASKETBALL just because BASEBALL is gone).
  const dupe = round.answers.some((a) =>
    [a.a, ...(a.alts ?? [])].some((t) => normalizeGuess(t) === g),
  );
  if (dupe) return -1;
  return round.answers.findIndex(
    (a, i) => !found[i] && guessMatches(guess, a.a, a.alts),
  );
}

// The shared board, derived identically on every screen from the round's
// submissions: all guesses in time order, each claiming the first answer it
// matches. In teams mode `solveIds`/`stealIds` restrict whose guesses count
// in each phase; steal guesses never count outside teams mode.
export function deriveBoard(
  round: LetterRound,
  subs: { player_id: string; payload: unknown }[],
  opts: { solveIds?: string[]; stealIds?: string[] } = {},
): (Claim | null)[] {
  const found: (Claim | null)[] = round.answers.map(() => null);
  const all: (LetterGuess & { player_id: string })[] = [];
  for (const s of subs) {
    const guesses = (s.payload as Partial<GuessPayload> | null)?.guesses;
    if (!Array.isArray(guesses)) continue;
    for (const g of guesses) {
      if (typeof g?.g === "string" && typeof g?.t === "number") {
        all.push({ ...g, player_id: s.player_id });
      }
    }
  }
  all.sort((a, b) => a.t - b.t || a.player_id.localeCompare(b.player_id));
  for (const g of all) {
    if (g.ph === "steal") {
      if (!opts.stealIds || !opts.stealIds.includes(g.player_id)) continue;
    } else if (opts.solveIds && !opts.solveIds.includes(g.player_id)) {
      continue;
    }
    const idx = matchIdx(g.g, round, found);
    if (idx >= 0) found[idx] = { player_id: g.player_id, ph: g.ph };
  }
  return found;
}

// --- teams ---------------------------------------------------------------

// Teams are join order, alternating — deterministic, nothing to store.
export const TEAM_META = [
  { name: "Team Gold", dot: "🟡" },
  { name: "Team Violet", dot: "🟣" },
] as const;

export const teamOf = (seat: number) => seat % 2;
export const activeTeam = (roundIdx: number) => roundIdx % 2;

export function teamIds(playerIds: string[], team: number): string[] {
  return playerIds.filter((_, i) => teamOf(i) === team);
}
