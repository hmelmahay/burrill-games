// Letter Rip content + board-derivation tests. No database, no build step:
//
//     node --experimental-strip-types lib/letterrip.test.ts
//
// The bank rules matter: an in-board duplicate silently eats claims, and the
// claim arbiter is what keeps every screen showing the same board.

import { LETTER_BANK } from "./content/letterrip.ts";
import { normalizeGuess } from "./matching.ts";
import {
  BOARD_ANSWERS,
  MAX_BOARDS,
  SLOT_POINTS,
  slotPoints,
  maskCells,
  matchIdx,
  deriveBoard,
  teamOf,
  activeTeam,
  teamIds,
} from "../app/letterrip/constants.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) passed++;
  else failures.push(name);
}

// --- bank shape ---------------------------------------------------------
check("bank can deal every game", LETTER_BANK.length >= MAX_BOARDS);
check("bank has plenty of boards", LETTER_BANK.length >= 30);
for (const [i, board] of LETTER_BANK.entries()) {
  const tag = `board ${i} (${board.cat})`;
  check(
    `${tag}: exactly ${BOARD_ANSWERS} answers`,
    board.answers.length === BOARD_ANSWERS,
  );
  check(
    `${tag}: every answer survives normalization`,
    board.answers.every((a) => normalizeGuess(a.a).length > 0),
  );
  // No answer (or alt) may exactly equal a DIFFERENT answer on the same
  // board — a guess would silently claim the wrong tile.
  for (let x = 0; x < board.answers.length; x++) {
    const forms = [board.answers[x].a, ...(board.answers[x].alts ?? [])].map(
      normalizeGuess,
    );
    for (let y = 0; y < board.answers.length; y++) {
      if (x === y) continue;
      const other = normalizeGuess(board.answers[y].a);
      check(
        `${tag}: "${board.answers[x].a}" forms don't collide with "${board.answers[y].a}"`,
        !forms.includes(other),
      );
    }
  }
}

// --- masking ------------------------------------------------------------
{
  const cells = maskCells("Top Gun");
  check("mask splits words", cells.length === 2);
  check("mask shows the first letter", cells[0][0].shown && cells[0][0].ch === "T");
  check("mask hides the rest of word one", !cells[0][1].shown && !cells[0][2].shown);
  check("mask hides the second word entirely", cells[1].every((c) => !c.shown));
  const punct = maskCells("Chick-fil-A");
  check("mask keeps punctuation visible", punct[0][5].ch === "-" && punct[0][5].shown);
}

// --- claim arbitration --------------------------------------------------
const board = {
  cat: "Sports",
  answers: [
    { a: "Football" },
    { a: "Basketball" },
    { a: "Baseball" },
    { a: "Soccer" },
    { a: "Tennis" },
    { a: "Hockey", alts: ["ice hockey"] },
  ],
};

{
  // Exact matches beat the typo tolerance of a look-alike neighbour.
  const none = board.answers.map(() => null);
  check("exact guess claims its own tile", matchIdx("baseball", board, none) === 2);
  check("typo still lands on the nearest tile", matchIdx("basketbal", board, none) === 1);
  check("alt spellings count", matchIdx("ice hockey", board, none) === 5);
  check("nonsense matches nothing", matchIdx("zzzzz", board, none) === -1);
  const taken = [null, null, { x: 1 }, null, null, null];
  check("a found tile can't be reclaimed", matchIdx("baseball", board, taken) === -1);
}

{
  // Earlier guess wins the claim regardless of row order.
  const subs = [
    { player_id: "b", payload: { guesses: [{ g: "soccer", t: 200, ph: "solve" }] } },
    { player_id: "a", payload: { guesses: [{ g: "soccer", t: 100, ph: "solve" }] } },
  ];
  const found = deriveBoard(board, subs);
  check("earliest guess claims the tile", found[3]?.player_id === "a");
  check("nothing else is claimed", found.filter(Boolean).length === 1);
}

{
  // Teams: only the active side's solve guesses and the other side's steal
  // guesses count; steals never count outside teams mode.
  const subs = [
    { player_id: "atk", payload: { guesses: [{ g: "tennis", t: 1, ph: "solve" }] } },
    { player_id: "def", payload: { guesses: [{ g: "soccer", t: 2, ph: "solve" }] } },
    { player_id: "def", payload: { guesses: [{ g: "hockey", t: 3, ph: "steal" }] } },
  ];
  const found = deriveBoard(board, subs, { solveIds: ["atk"], stealIds: ["def"] });
  check("active team's solve counts", found[4]?.player_id === "atk");
  check("defender's solve is ignored", found[3] === null);
  check("defender's steal counts", found[5]?.player_id === "def" && found[5]?.ph === "steal");
  const ffa = deriveBoard(board, subs);
  check("steals are ignored outside teams mode", ffa[5] === null);
  check("everyone's solves count in free-for-all", ffa[3]?.player_id === "def");
}

{
  // Garbage payloads never crash the derivation.
  const subs = [
    { player_id: "x", payload: null },
    { player_id: "y", payload: { guesses: "nope" } },
    { player_id: "z", payload: { guesses: [{ g: 5, t: "later" }, { g: "tennis", t: 9, ph: "solve" }] },
    },
  ];
  const found = deriveBoard(board, subs);
  check("malformed payloads are skipped", found[4]?.player_id === "z");
}

// --- scoring & teams ----------------------------------------------------
check("a full board's points are laid out", SLOT_POINTS.length === BOARD_ANSWERS);
check("the board pays more toward the bottom", slotPoints(5) > slotPoints(0));
check("seats alternate teams", teamOf(0) === 0 && teamOf(1) === 1 && teamOf(2) === 0);
check("boards alternate the active team", activeTeam(0) === 0 && activeTeam(1) === 1);
check(
  "teamIds picks alternating seats",
  JSON.stringify(teamIds(["p", "q", "r", "s"], 1)) === JSON.stringify(["q", "s"]),
);

// --- report -------------------------------------------------------------
if (failures.length) {
  console.error(`✗ ${failures.length} failed (of ${passed + failures.length}):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✓ letterrip: all ${passed} checks passed`);
