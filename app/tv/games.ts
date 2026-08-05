import { GameKind } from "@/lib/supabase";

// Display names for the TV surfaces (entry page + legacy scoreboard).
export const GAME_NAMES: Record<GameKind, string> = {
  quiz: "⚡ Quiz Rush",
  majority: "🐑 Majority Rules",
  scatter: "📝 Scatter Sprint",
  emoji: "🎬 Emoji Cinema",
  ballpark: "🎯 Ballpark",
  twotruths: "🤥 Two Truths & a Lie",
  hottake: "🔥 Hot Take",
  doodle: "🎨 Doodle Dash",
  vibe: "🌡️ Vibe Check",
};
