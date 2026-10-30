// Pure helpers for the arcade look. No React and no browser APIs, so server
// components and route handlers can import this file too.

export type Tone = "glow" | "violet" | "gold" | "pink" | "cyan" | "win" | "lose" | "fog";

export const TONE_HEX: Record<Tone, string> = {
  glow: "#ff9f1c",
  violet: "#7c5cff",
  gold: "#ffd166",
  pink: "#ff4fd8",
  cyan: "#2de2e6",
  win: "#2ecc71",
  lose: "#e74c3c",
  fog: "#9aa0c8",
};

// One rhythm for every game, in ms. Host, TV and phones read the same numbers.
export const FX = {
  stagger: 60, // between list rows
  count: 700, // RollingNumber
  flip: 450, // leaderboard row slide
  settle: 150, // leaderboard waits this long for score events to stop
  mountSettle: 350, // a fresh leaderboard shows the old order this long, then slides
  drum: 1100, // Drumroll
  freshMs: 4000, // first look at a phase: stage it only if it started this recently
  liveMs: 8000, // phase change seen live on this screen
  reloadHold: 2800, // a reloaded tab replays a phase it played only while the room's beats may still be ahead (latest phone beat 2500)
} as const;

// Player colors: never green or red, which mean right and wrong.
export const PLAYER_HUES = ["#ff9f1c", "#a78bfa", "#ffd166", "#ff4fd8", "#2de2e6", "#5cc8ff"] as const;

export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function playerHue(id: string): string {
  return PLAYER_HUES[hashString(id) % PLAYER_HUES.length];
}

export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

// Competition ranking ("1, 1, 3") for scores already sorted high to low.
export function competitionRanks(scoresDesc: number[]): number[] {
  const out: number[] = [];
  scoresDesc.forEach((s, i) => {
    out.push(i > 0 && s === scoresDesc[i - 1] ? out[i - 1] : i + 1);
  });
  return out;
}

export function ordinal(n: number): string {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// Seeded random so a layout is the same on every render and every screen.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Delay for item i of n: `step` apart, squeezed so the run never passes maxTotal.
export function stagger(i: number, n: number, step: number, maxTotal: number): number {
  if (n <= 1) return 0;
  return Math.round(i * Math.min(step, maxTotal / (n - 1)));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
