import type { GameKind } from "./supabase";

// One registry for game names, icons and accents. Server-safe: the /tv/view
// route handler and the landing page import it. The accent mapping is mirrored
// by the [data-game] rules in app/globals.css; change both together.
export type GameSlug = GameKind | "needle";
export type AccentName = "orange" | "violet" | "gold" | "pink" | "cyan";

export const ACCENTS: Record<AccentName, { acc: string; core: string; glow: string; soft: string; deep: string }> = {
  orange: { acc: "#ff9f1c", core: "#ffd29a", glow: "rgba(255,159,28,.55)", soft: "rgba(255,159,28,.12)", deep: "#a35f00" },
  violet: { acc: "#7c5cff", core: "#cfc4ff", glow: "rgba(124,92,255,.6)", soft: "rgba(124,92,255,.14)", deep: "#4a32b5" },
  gold: { acc: "#ffd166", core: "#fff1c9", glow: "rgba(255,209,102,.5)", soft: "rgba(255,209,102,.12)", deep: "#a37f1f" },
  pink: { acc: "#ff4fd8", core: "#ffc6f3", glow: "rgba(255,79,216,.5)", soft: "rgba(255,79,216,.12)", deep: "#a3288a" },
  cyan: { acc: "#2de2e6", core: "#c8fbfc", glow: "rgba(45,226,230,.45)", soft: "rgba(45,226,230,.12)", deep: "#1a8f92" },
};

export const GAME_META: Record<GameSlug, { name: string; icon: string; accent: AccentName }> = {
  needle: { name: "Needle Drop", icon: "🎵", accent: "pink" },
  quiz: { name: "Quiz Rush", icon: "⚡", accent: "gold" },
  majority: { name: "Majority Rules", icon: "🐑", accent: "violet" },
  scatter: { name: "Scatter Sprint", icon: "📝", accent: "orange" },
  emoji: { name: "Emoji Cinema", icon: "🎬", accent: "gold" },
  ballpark: { name: "Ballpark", icon: "🎯", accent: "cyan" },
  twotruths: { name: "Two Truths & a Lie", icon: "🤥", accent: "violet" },
  hottake: { name: "Hot Take", icon: "🔥", accent: "orange" },
  doodle: { name: "Doodle Dash", icon: "🎨", accent: "violet" },
  vibe: { name: "Vibe Check", icon: "🌡️", accent: "pink" },
  chameleon: { name: "Chameleon", icon: "🦎", accent: "cyan" },
  chain: { name: "Chain Gang", icon: "⛓️", accent: "gold" },
};

export function displayName(slug: GameSlug): string {
  return `${GAME_META[slug].icon} ${GAME_META[slug].name}`;
}
