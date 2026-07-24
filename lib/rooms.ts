import { supabase, Room, Player, GameKind } from "./supabase";

// 4-char join code, unambiguous chars only (no I, O, 0, 1).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(len = 4): string {
  let out = "";
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Insert a room, retrying the code on unique-violation (23505).
export async function createRoom(
  game: GameKind,
  rounds: unknown[],
  settings: Record<string, unknown>,
): Promise<{ room?: Room; error?: string }> {
  for (let i = 0; i < 8; i++) {
    const code = generateCode(4);
    const { data, error } = await supabase
      .from("arcade_rooms")
      .insert({ game, code, rounds, settings })
      .select()
      .single();
    if (!error && data) return { room: data as Room };
    if (error && error.code !== "23505") return { error: error.message };
  }
  return { error: "Couldn't generate a unique room code. Try again." };
}

export async function joinRoom(
  game: GameKind,
  code: string,
  name: string,
): Promise<{ player?: Player; room?: Room; error?: string }> {
  const { data: room, error: rErr } = await supabase
    .from("arcade_rooms")
    .select("*")
    .eq("code", code)
    .eq("game", game)
    .maybeSingle();
  if (rErr) return { error: rErr.message };
  if (!room) return { error: "Room not found. Check the code." };
  const r = room as Room;
  if (r.status === "ended") return { error: "That game has ended." };
  if (r.status !== "lobby") return { error: "That game already started." };
  const { data: player, error: pErr } = await supabase
    .from("arcade_players")
    .insert({ room_id: r.id, name })
    .select()
    .single();
  if (pErr) return { error: pErr.message };
  return { player: player as Player, room: r };
}

// localStorage keys so refreshes rehydrate
export const playerKey = (code: string) => `arcade-player-${code}`;
export const hostKey = (code: string) => `arcade-host-${code}`;
