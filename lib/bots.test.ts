// Unit tests for the bot layer. No database, no build step:
//
//     node --experimental-strip-types lib/bots.test.ts
//
// Covers the pure logic plus a replay of the host's Vibe Check scoring math,
// so a regression in bot behaviour or round scoring fails here first.

import {
  isBot,
  humansOf,
  botsOf,
  nextBotName,
  botSkill,
  botDelayMs,
  botDialGuess,
  botNumberGuess,
  crowdBias,
  botBinaryVote,
  botPredict,
  botQuizChoice,
  botQuizDelayMs,
  hotTakeFavourite,
  botHotTakeVote,
  BOT_FULL_NAMES,
} from "./bot-logic.ts";
import { pointsForDistance, PSYCHIC_PER_CLOSE, CLOSE_RANGE } from "../app/vibe/constants.ts";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = "") {
  if (cond) passed++;
  else failures.push(`${name}${detail ? " — " + detail : ""}`);
}

// --- identifying bots ---------------------------------------------------
const ada = { id: "a", name: BOT_FULL_NAMES[0] };
const human = { id: "h", name: "Mike" };
const trickster = { id: "t", name: "Dave \u{1F916}" };
const nearMiss = { id: "n", name: "Ada" };

check("house bot is a bot", isBot(ada));
check("plain human is not a bot", !isBot(human));
check("human named 'Dave robot' is NOT a bot", !isBot(trickster));
check("human named 'Ada' (no emoji) is NOT a bot", !isBot(nearMiss));

const roster = [ada, human, trickster, nearMiss];
check("humansOf keeps every non-house player", humansOf(roster).length === 3);
check("botsOf finds only the house bot", botsOf(roster).length === 1);
check(
  "humansOf + botsOf partition the roster",
  humansOf(roster).length + botsOf(roster).length === roster.length,
);

// --- seating ------------------------------------------------------------
check("first bot name is free in an empty room", nextBotName([]) === BOT_FULL_NAMES[0]);
check(
  "seating skips a name already taken",
  nextBotName([{ name: BOT_FULL_NAMES[0] }]) === BOT_FULL_NAMES[1],
);
check(
  "a full bench returns null instead of a duplicate",
  nextBotName(BOT_FULL_NAMES.map((n) => ({ name: n }))) === null,
);

// --- skill & timing -----------------------------------------------------
const s1 = botSkill("abc-123");
check("skill is stable for the same id", s1 === botSkill("abc-123"));
check("skill stays within 0..1", s1 >= 0 && s1 < 1);
const skills = new Set(
  ["id-1", "id-2", "id-3", "id-4", "id-5", "id-6"].map((i) => botSkill(i).toFixed(3)),
);
check("different bots get different skills", skills.size >= 5, `${skills.size} distinct of 6`);
check("delay floor is humanlike", botDelayMs(() => 0) === 1500);
check("delay ceiling is bounded", botDelayMs(() => 1) === 6000);

// --- dial guessing ------------------------------------------------------
let outOfRange = 0;
let sharpTotal = 0;
let fuzzyTotal = 0;
const N = 20000;
for (let i = 0; i < N; i++) {
  const target = 5 + Math.floor(Math.random() * 91);
  const sharp = botDialGuess(target, 0.95);
  const fuzzy = botDialGuess(target, 0.05);
  if (sharp < 0 || sharp > 100 || fuzzy < 0 || fuzzy > 100) outOfRange++;
  if (!Number.isInteger(sharp) || !Number.isInteger(fuzzy)) outOfRange++;
  sharpTotal += Math.abs(sharp - target);
  fuzzyTotal += Math.abs(fuzzy - target);
}
const sharpAvg = sharpTotal / N;
const fuzzyAvg = fuzzyTotal / N;
check("every guess is an integer inside 0..100", outOfRange === 0, `${outOfRange} bad`);
check("sharp bots beat fuzzy bots on average", sharpAvg < fuzzyAvg,
  `sharp ${sharpAvg.toFixed(1)} vs fuzzy ${fuzzyAvg.toFixed(1)}`);
check("sharp bots average within ~10 of target", sharpAvg < 12, `${sharpAvg.toFixed(1)}`);
check("fuzzy bots are wide but not random", fuzzyAvg > 12 && fuzzyAvg < 32, `${fuzzyAvg.toFixed(1)}`);
check("guesses clamp at the left edge", botDialGuess(0, 0.05, () => 0) === 0);
check("guesses clamp at the right edge", botDialGuess(100, 0.05, () => 1) === 100);

// --- a solo game: 1 human + 2 bots --------------------------------------
// Mirrors the host page: rounds rotate through humans only, bots guess,
// psychic scores per guesser within CLOSE_RANGE.
const solo = [human, { id: "b1", name: BOT_FULL_NAMES[0] }, { id: "b2", name: BOT_FULL_NAMES[1] }];
const cycles = 2;
const rounds = humansOf(solo).length * cycles;
check("solo game has 3 players so Start is legal", solo.length >= 3);
check("solo game still has a human to be psychic", humansOf(solo).length >= 1);
check("round count = humans x cycles", rounds === 2, `${rounds}`);
check(
  "no bot is ever scheduled as psychic",
  humansOf(solo).every((p) => !isBot(p)),
);

let scoredRounds = 0;
for (let r = 0; r < 500; r++) {
  const target = 5 + Math.floor(Math.random() * 91);
  const psychic = humansOf(solo)[0];
  let close = 0;
  let guesserPoints = 0;
  for (const bot of botsOf(solo)) {
    const guess = botDialGuess(target, botSkill(bot.id));
    const d = Math.abs(guess - target);
    const pts = pointsForDistance(d);
    if (pts < 0 || pts > 500 || Number.isNaN(pts)) failures.push("illegal guesser points " + pts);
    guesserPoints += pts;
    if (d <= CLOSE_RANGE) close++;
  }
  const psychicPoints = close * PSYCHIC_PER_CLOSE;
  if (Number.isNaN(psychicPoints) || psychicPoints > botsOf(solo).length * PSYCHIC_PER_CLOSE) {
    failures.push("illegal psychic points " + psychicPoints);
  }
  if (guesserPoints + psychicPoints > 0) scoredRounds++;
  void psychic;
}
check("solo rounds actually put points on the board", scoredRounds > 400, `${scoredRounds}/500`);


// --- Ballpark: numeric guesses ------------------------------------------
// Error must scale with the answer, so a piano (88 keys) and the Great Wall
// (21196 km) both get plausible misses.
let badNumbers = 0;
const relErr: Record<string, number[]> = { sharp: [], fuzzy: [] };
for (const answer of [88, 206, 330, 21196]) {
  for (let i = 0; i < 3000; i++) {
    const sharp = botNumberGuess(answer, 0.95);
    const fuzzy = botNumberGuess(answer, 0.05);
    if (sharp < 0 || fuzzy < 0) badNumbers++;
    if (!Number.isInteger(sharp) || !Number.isInteger(fuzzy)) badNumbers++;
    relErr.sharp.push(Math.abs(sharp - answer) / answer);
    relErr.fuzzy.push(Math.abs(fuzzy - answer) / answer);
  }
}
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sharpRel = avg(relErr.sharp);
const fuzzyRel = avg(relErr.fuzzy);
check("numeric guesses are non-negative integers", badNumbers === 0, `${badNumbers} bad`);
check("sharp bots are closer than fuzzy bots", sharpRel < fuzzyRel,
  `${(sharpRel * 100).toFixed(1)}% vs ${(fuzzyRel * 100).toFixed(1)}%`);
check("sharp bots land within ~10% on average", sharpRel < 0.12, `${(sharpRel * 100).toFixed(1)}%`);
check("fuzzy bots miss wide but stay plausible", fuzzyRel > 0.1 && fuzzyRel < 0.5,
  `${(fuzzyRel * 100).toFixed(1)}%`);
check("a zero answer cannot produce a negative guess", botNumberGuess(0, 0.05, () => 0) >= 0);

// --- Majority Rules: crowd leaning --------------------------------------
const bias1 = crowdBias("Pizza|Tacos");
check("crowd bias is stable for the same prompt", bias1 === crowdBias("Pizza|Tacos"));
check("crowd bias avoids the extremes", bias1 >= 0.2 && bias1 <= 0.8, `${bias1}`);
const biases = new Set(
  ["Pizza|Tacos", "Dogs|Cats", "Summer|Winter", "Coffee|Tea", "Sweet|Salty"].map((s) =>
    crowdBias(s).toFixed(3),
  ),
);
check("different prompts lean different ways", biases.size >= 4, `${biases.size} distinct of 5`);

// Bots must cluster, not coin-flip — otherwise predicting the room is luck
// and the whole game stops working.
let aVotes = 0;
const trials = 20000;
for (let i = 0; i < trials; i++) if (botBinaryVote(0.75) === "a") aVotes++;
check("votes follow the crowd leaning", Math.abs(aVotes / trials - 0.75) < 0.02,
  `${((aVotes / trials) * 100).toFixed(1)}% picked a`);

let sharpRight = 0;
let fuzzyRight = 0;
for (let i = 0; i < trials; i++) {
  if (botPredict(0.75, 0.95) === "a") sharpRight++;
  if (botPredict(0.75, 0.05) === "a") fuzzyRight++;
}
check("sharp bots read the room better than fuzzy ones", sharpRight > fuzzyRight,
  `${((sharpRight / trials) * 100).toFixed(0)}% vs ${((fuzzyRight / trials) * 100).toFixed(0)}%`);
check("even sharp bots are wrong sometimes", sharpRight < trials * 0.98);
check("fuzzy bots still beat pure noise sometimes", fuzzyRight > trials * 0.3);

// A solo Majority round: 1 human + 3 bots should produce a real majority
// often enough that predictions are meaningful.
let decisive = 0;
for (let r = 0; r < 2000; r++) {
  const b = crowdBias(`round-${r}`);
  const votes = [0, 1, 2].map(() => botBinaryVote(b));
  const a = votes.filter((v) => v === "a").length;
  if (a !== votes.length - a) decisive++;
}
check("bot rooms usually produce a clear majority", decisive > 1800, `${decisive}/2000`);


// --- Quiz Rush ----------------------------------------------------------
let sharpCorrect = 0;
let fuzzyCorrect = 0;
let illegalChoice = 0;
const wrongSpread = [0, 0, 0, 0];
for (let i = 0; i < 20000; i++) {
  const answer = 2;
  const s = botQuizChoice(answer, 0.95);
  const f = botQuizChoice(answer, 0.05);
  if (![0, 1, 2, 3].includes(s) || ![0, 1, 2, 3].includes(f)) illegalChoice++;
  if (s === answer) sharpCorrect++;
  if (f === answer) fuzzyCorrect++;
  else wrongSpread[f]++;
}
check("quiz choices are always 0..3", illegalChoice === 0, `${illegalChoice} bad`);
check("sharp bots answer correctly more often", sharpCorrect > fuzzyCorrect,
  `${((sharpCorrect / 20000) * 100).toFixed(0)}% vs ${((fuzzyCorrect / 20000) * 100).toFixed(0)}%`);
check("sharp bots are not infallible", sharpCorrect < 20000 * 0.97);
check("fuzzy bots still beat random guessing", fuzzyCorrect > 20000 * 0.2);
check("wrong answers spread across all three wrong choices",
  wrongSpread[0] > 0 && wrongSpread[1] > 0 && wrongSpread[3] > 0);
check("the correct answer never appears as a 'wrong' pick", wrongSpread[2] === 0);

// Quiz scores by arrival time, so a delay outside the window would mean the
// bot effectively never answers.
let outsideWindow = 0;
let sharpMs = 0;
let fuzzyMs = 0;
for (const secs of [10, 20, 45]) {
  for (let i = 0; i < 5000; i++) {
    const s = botQuizDelayMs(0.95, secs);
    const f = botQuizDelayMs(0.05, secs);
    if (s <= 0 || s >= secs * 1000 || f <= 0 || f >= secs * 1000) outsideWindow++;
    if (secs === 20) {
      sharpMs += s;
      fuzzyMs += f;
    }
  }
}
check("every quiz answer lands inside the clock", outsideWindow === 0, `${outsideWindow} outside`);
check("sharp bots answer faster than fuzzy ones", sharpMs < fuzzyMs,
  `${(sharpMs / 5000 / 1000).toFixed(1)}s vs ${(fuzzyMs / 5000 / 1000).toFixed(1)}s`);

// --- Hot Take -----------------------------------------------------------
const cands = ["p1", "p2", "p3", "p4"];
const fav = hotTakeFavourite("Most likely to sleep through three alarms", cands);
check("a favourite is chosen from the candidates", fav !== null && cands.includes(fav));
check("the favourite is stable for the same prompt",
  fav === hotTakeFavourite("Most likely to sleep through three alarms", cands));
const favs = new Set(
  ["a", "b", "c", "d", "e", "f"].map((q) => hotTakeFavourite("prompt " + q, cands)),
);
check("different prompts pick different favourites", favs.size >= 2, `${favs.size} distinct`);
check("no candidates yields null", hotTakeFavourite("x", []) === null);
check("a single candidate is always the favourite", hotTakeFavourite("x", ["only"]) === "only");

let favVotes = 0;
let wildVotes = 0;
let nullVotes = 0;
for (let i = 0; i < 20000; i++) {
  const v = botHotTakeVote("Most likely to sleep through three alarms", cands, 0.9);
  if (v === null) nullVotes++;
  else if (v === fav) favVotes++;
  else wildVotes++;
}
check("hot take votes are never null with candidates", nullVotes === 0);
check("bots mostly back the room favourite", favVotes > wildVotes,
  `${((favVotes / 20000) * 100).toFixed(0)}% favourite`);
check("bots still throw wildcards", wildVotes > 20000 * 0.02);
check("a lone-candidate room still votes", botHotTakeVote("x", ["solo"], 0.5) === "solo");

// A plurality must actually form, or "read the room" scoring is meaningless.
function pluralityRate(botIds: string[], trials = 2000): number {
  let clear = 0;
  for (let r = 0; r < trials; r++) {
    const counts: Record<string, number> = {};
    for (const id of botIds) {
      const v = botHotTakeVote(`prompt-${r}`, cands, botSkill(id));
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    }
    const sorted = Object.values(counts).sort((a, b) => b - a);
    if (sorted.length > 0 && (sorted.length === 1 || sorted[0] > sorted[1])) clear++;
  }
  return clear / trials;
}
// Three voters and four candidates is the hardest case — 1-1-1 splits are
// unavoidable sometimes, exactly as they would be with three humans.
const plural3 = pluralityRate(["b1", "b2", "b3"]);
const plural5 = pluralityRate(["b1", "b2", "b3", "b4", "b5"]);
check("a 3-bot room usually reaches a plurality", plural3 > 0.75, `${(plural3 * 100).toFixed(0)}%`);
check("a 5-bot room decides more reliably", plural5 > 0.85, `${(plural5 * 100).toFixed(0)}%`);
check("bigger rooms decide more often than small ones", plural5 > plural3,
  `${(plural5 * 100).toFixed(0)}% vs ${(plural3 * 100).toFixed(0)}%`);

// --- report -------------------------------------------------------------
console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log("  FAIL " + f);
console.log(
  `\nguess accuracy: sharp bot avg ${sharpAvg.toFixed(1)} from target, fuzzy bot avg ${fuzzyAvg.toFixed(1)}`,
);
process.exit(failures.length ? 1 : 0);
