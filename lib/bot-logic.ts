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

// A dial guess near the target: sharp bots land ~±10, fuzzy bots ~±30.
// Sum of three uniforms approximates a bell curve, so guesses cluster near
// the target with occasional wide misses — like a real player reading a clue.
export function botDialGuess(
  target: number,
  skill: number,
  rand: () => number = Math.random,
): number {
  const sigma = 10 + (1 - skill) * 20;
  const noise = (rand() + rand() + rand() - 1.5) * sigma * 1.6;
  return Math.max(0, Math.min(100, Math.round(target + noise)));
}
