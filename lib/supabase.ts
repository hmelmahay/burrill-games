import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  realtime: { params: { eventsPerSecond: 10 } },
});

export type GameKind =
  | "quiz"
  | "majority"
  | "scatter"
  | "emoji"
  | "ballpark"
  | "twotruths"
  | "hottake"
  | "doodle"
  | "vibe";

export type Room = {
  id: string;
  game: GameKind;
  code: string;
  status: "lobby" | "playing" | "ended";
  phase: string;
  round_idx: number;
  rounds: unknown[];
  phase_data: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  name: string;
  score: number;
  created_at: string;
};

export type Sub = {
  id: string;
  room_id: string;
  player_id: string;
  round_idx: number;
  payload: Record<string, unknown>;
  created_at: string;
};

// Round content per game
export type QuizRound = { q: string; choices: string[]; answer: number; cat: string };
export type EmojiRound = { emoji: string; answer: string; alts: string[]; kind: string };
export type BallparkRound = { q: string; answer: number; unit: string };
export type MajorityRound = { a: string; b: string };
export type ScatterRound = { letter: string; categories: string[] };

// Per-round results the host writes into phase_data for reveal screens
export type RoundResult = { player_id: string; name: string; gained: number; detail?: string };
