// Pure bot logic — no imports, so it is unit-testable without a database.
// The Supabase-touching helpers (addBot/removeBot) live in ./bots.

// House bots are ordinary player rows flagged by a name suffix — no schema
// change, and every scoreboard/chip list shows them as robots for free.
export const BOT_SUFFIX = " \u{1F916}";
export const BOT_NAMES = ["Ada", "Brick", "Cleo", "Dot", "Ember", "Fig", "Gus"];
export const BOT_FULL_NAMES = BOT_NAMES.map((n) => n + BOT_SUFFIX);

const BOT_NAME_SET = new Set(BOT_FULL_NAMES);

// Exact-match against the house-bot roster, so a human who names
// themselves "Dave 🤖" is still a human (and still gets the psychic seat).
export function isBot(p: { name: string }): boolean {
  return BOT_NAME_SET.has(p.name);
}
export function humansOf<T extends { name: string }>(players: T[]): T[] {
  return players.filter((p) => !isBot(p));
}
export function botsOf<T extends { name: string }>(players: T[]): T[] {
  return players.filter(isBot);
}

export function nextBotName(players: { name: string }[]): string | null {
  const used = new Set(players.map((p) => p.name));
  return BOT_FULL_NAMES.find((n) => !used.has(n)) ?? null;
}

// Stable 0..1 "skill" per bot id, so each bot is consistently sharper or
// fuzzier across a whole game instead of coin-flipping every round.
export function botSkill(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Humanlike thinking time before a bot answers.
export function botDelayMs(rand: () => number = Math.random): number {
  return 1500 + rand() * 4500;
}

// Bell-ish noise in roughly -1.5..1.5, from three uniforms.
function bellNoise(rand: () => number): number {
  return rand() + rand() + rand() - 1.5;
}

// A numeric guess near a true answer (Ballpark). Error is proportional, so
// "how tall is the Eiffel Tower" and "how many keys on a piano" both get
// plausible misses instead of one being absurd. Never returns a negative.
export function botNumberGuess(
  answer: number,
  skill: number,
  rand: () => number = Math.random,
): number {
  const spread = 0.08 + (1 - skill) * 0.4;
  const guess = answer * (1 + bellNoise(rand) * spread);
  const rounded = Math.round(guess);
  return Math.max(0, rounded);
}

// Either/or prompts (Majority Rules) need the bots to have shared taste —
// if every bot flipped a fair coin, predicting the room would be pure luck
// and the game would stop working. This derives a stable per-round crowd
// leaning in 0..1 (probability of picking "a") from the prompt itself.
export function crowdBias(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // Keep it off the extremes so rounds stay interesting: 0.2..0.8
  return 0.2 + (h % 601) / 1000;
}

// A bot's own either/or pick, following the crowd leaning.
export function botBinaryVote(bias: number, rand: () => number = Math.random): "a" | "b" {
  return rand() < bias ? "a" : "b";
}

// A bot's prediction of which way the room went. Sharp bots read the crowd
// leaning well; fuzzy bots often call it wrong.
export function botPredict(
  bias: number,
  skill: number,
  rand: () => number = Math.random,
): "a" | "b" {
  const likely: "a" | "b" = bias >= 0.5 ? "a" : "b";
  const other: "a" | "b" = likely === "a" ? "b" : "a";
  const accuracy = 0.45 + skill * 0.5;
  return rand() < accuracy ? likely : other;
}

// A dial guess near the target: sharp bots land ~±10, fuzzy bots ~±30.
// Sum of three uniforms approximates a bell curve, so guesses cluster near
// the target with occasional wide misses — like a real player reading a clue.
export function botDialGuess(
  target: number,
  skill: number,
  rand: () => number = Math.random,
): number {
  const sigma = 10 + (1 - skill) * 20;
  const noise = bellNoise(rand) * sigma * 1.6;
  return Math.max(0, Math.min(100, Math.round(target + noise)));
}
