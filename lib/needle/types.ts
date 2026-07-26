// Needle Drop (music bingo) types — ported from the standalone needle-drop app.
// Its tables (pools/songs/games/cards) live in the same Supabase project, so the
// arcade app reuses the shared client and the data carries over untouched.
export { supabase } from "../supabase";

export type Pool = { id: string; name: string; created_at: string };
export type Song = {
  id: string;
  pool_id: string;
  name: string;
  // Generic song key: an 11-char YouTube id, or "it_<trackId>" for iTunes songs.
  youtube_id: string;
  // 30s Apple preview clip; when set, playback uses this instead of YouTube.
  preview_url: string | null;
  artist: string | null;
  created_at: string;
};
export type Pattern = "line" | "blackout" | "fourcorners";
export type Difficulty = "expert" | "novice" | "beginner";
export type Cell = { youtube_id: string; name: string } | { free: true };
export type Game = {
  id: string;
  code: string;
  pool_id: string;
  clip_seconds: number;
  pattern: Pattern;
  difficulty: Difficulty;
  play_order: string[];
  called: string[];
  status: "live" | "ended";
  created_at: string;
};
export type Card = {
  id: string;
  game_id: string;
  label: string;
  player_name: string | null;
  grid: Cell[];
  claimed: boolean;
  created_at: string;
};
