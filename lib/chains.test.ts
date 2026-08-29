// Chain Gang content + scoring tests. No database, no build step:
//
//     node --experimental-strip-types lib/chains.test.ts
//
// The bank rules matter: one malformed chain strands every room it's dealt to.

import { CHAIN_BANK } from "./content/chains.ts";
import {
  wordValue,
  maskWord,
  chainGuessOk,
  duelOpener,
  duelChainIdx,
  CHAIN_LEN,
  WORD_MAX,
  WORD_MIN,
} from "../app/chain/constants.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean) {
  if (ok) passed++;
  else failures.push(name);
}

// --- bank shape ---------------------------------------------------------
check("bank has plenty of chains", CHAIN_BANK.length >= 20);
for (const [i, chain] of CHAIN_BANK.entries()) {
  const tag = `chain ${i} (${chain.words[0]})`;
  check(`${tag}: exactly ${CHAIN_LEN} words`, chain.words.length === CHAIN_LEN);
  check(
    `${tag}: uppercase A–Z only`,
    chain.words.every((w) => /^[A-Z]+$/.test(w)),
  );
  check(
    `${tag}: no word repeats inside the chain`,
    new Set(chain.words).size === chain.words.length,
  );
  check(
    `${tag}: every word 2+ letters`,
    chain.words.every((w) => w.length >= 2),
  );
}
check(
  "no two chains share a starting word",
  new Set(CHAIN_BANK.map((c) => c.words[0])).size === CHAIN_BANK.length,
);

// --- scoring ------------------------------------------------------------
check("unhinted word pays full value", wordValue(1, 5) === WORD_MAX);
check("each letter costs 2", wordValue(2, 5) === WORD_MAX - 2);
check("late letters keep costing", wordValue(4, 5) === WORD_MAX - 6);
check("value floors at the minimum", wordValue(6, 8) === WORD_MIN);
check("fully revealed word pays nothing", wordValue(5, 5) === 0);
check("over-revealed word pays nothing", wordValue(9, 5) === 0);

// --- masking ------------------------------------------------------------
check("mask shows the free letter", maskWord("FIRE", 1) === "F · · ·");
check("mask shows bought letters", maskWord("FIRE", 3) === "F I R ·");
check("mask caps at the word", maskWord("FIRE", 9) === "F I R E");

// --- matching -----------------------------------------------------------
check("exact guess matches", chainGuessOk("work", "WORK"));
check("case and spacing forgiven", chainGuessOk("  Work ", "WORK"));
check("one typo forgiven on longer words", chainGuessOk("sandwch", "SANDWICH"));
check("short words are strict", !chainGuessOk("wark", "WORK"));
check("wrong word rejected", chainGuessOk("shop", "WORK") === false);

// --- duel turn order ----------------------------------------------------
check("first chain opens with player 0", duelOpener(["a", "b"], 0) === "a");
check("second chain opens with player 1", duelOpener(["a", "b"], 1) === "b");
check("third chain wraps back", duelOpener(["a", "b"], 2) === "a");

// --- duel chain dealing -------------------------------------------------
// Each duel round consumes two chains, one per seat — no overlap anywhere.
check("round 0 deals chains 0 and 1", duelChainIdx(0, 0) === 0 && duelChainIdx(0, 1) === 1);
check("round 1 deals chains 2 and 3", duelChainIdx(1, 0) === 2 && duelChainIdx(1, 1) === 3);
check(
  "five duel rounds fit in the dealt deck",
  duelChainIdx(4, 1) === 9 && CHAIN_BANK.length >= 10,
);

// --- report -------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("  FAIL " + f);
process.exit(failures.length ? 1 : 0);
