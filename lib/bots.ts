import { supabase, Player, Room } from "./supabase";

// House bots are ordinary player rows flagged by a name suffix — no schema
// change, and every scoreboard/chip list shows them as robots for free.
export const BOT_SUFFIX = " \u{1F916}";
export const BOT_NAMES = ["Ada", "Brick", "Cleo", "Dot", "Ember", "Fig", "Gus"];

const BOT_FULL_NAMES = new Set(BOT_NAMES.map((n) => n + BOT_SUFFIX));

// Exact-match against the house-bot roster, so a human who names
// themselves "Dave 🤖" is still a human (and still gets the psychic seat).
export function isBot(p: { name: string }): boolean {
  return BOT_FULL_NAMES.has(p.name);
}
export function humansOf(players: Player[]): Player[] {
  return players.filter((p) => !isBot(p));
}
export function botsOf(players: Player[]): Player[] {
  return players.filter(isBot);
}

export async function addBot(room: Room, players: Player[]): Promise<string | null> {
  const used = new Set(players.map((p) => p.name));
  const name = BOT_NAMES.map((n) => n + BOT_SUFFIX).find((n) => !used.has(n));
  if (!name) return "All the bots are already seated.";
  const { error } = await supabase
    .from("arcade_players")
    .insert({ room_id: room.id, name });
  return error ? error.message : null;
}

export async function removeBot(players: Player[]): Promise<string | null> {
  const bot = botsOf(players).at(-1);
  if (!bot) return null;
  const { error } = await supabase.from("arcade_players").delete().eq("id", bot.id);
  return error ? error.message : null;
}

// Stable 0..1 "skill" per bot id, so each bot is consistently sharper or
// fuzzier across a whole game instead of coin-flipping every round.
export function botSkill(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

// Humanlike thinking time before a bot answers.
export function botDelayMs(): number {
  return 1500 + Math.random() * 4500;
}

// A dial guess near the target: sharp bots land ~±10, fuzzy bots ~±30.
export function botDialGuess(target: number, skill: number): number {
  const sigma = 10 + (1 - skill) * 20;
  const noise = (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.6;
  return Math.max(0, Math.min(100, Math.round(target + noise)));
}
