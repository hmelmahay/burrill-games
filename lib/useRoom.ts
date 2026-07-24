"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Player, Sub } from "./supabase";

// Live view of one room: the room row, its players, and this round's submissions.
// Everything updates via Realtime; a light poll backstops missed events.
export function useRoom(game: string, code: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [error, setError] = useState<string | null>(null);
  const roomIdRef = useRef<string | null>(null);

  async function refresh() {
    const { data: r } = await supabase
      .from("arcade_rooms")
      .select("*")
      .eq("code", code)
      .eq("game", game)
      .maybeSingle();
    if (!r) {
      setError("Room not found.");
      return;
    }
    const rm = r as Room;
    roomIdRef.current = rm.id;
    setRoom(rm);
    const [{ data: ps }, { data: ss }] = await Promise.all([
      supabase
        .from("arcade_players")
        .select("*")
        .eq("room_id", rm.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("arcade_subs")
        .select("*")
        .eq("room_id", rm.id)
        .eq("round_idx", rm.round_idx)
        .order("created_at", { ascending: true }),
    ]);
    setPlayers((ps as Player[]) ?? []);
    setSubs((ss as Sub[]) ?? []);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, game]);

  useEffect(() => {
    if (!room?.id) return;
    const roomId = room.id;
    const ch = supabase
      .channel(`room-${code}-${roomId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "arcade_rooms", filter: `id=eq.${roomId}` },
        (payload) => {
          const next = payload.new as Room;
          setRoom((r) => (r ? { ...r, ...next } : r));
          // New round: drop last round's submissions.
          setSubs((s) => s.filter((x) => x.round_idx === next.round_idx));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "arcade_players", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setPlayers((ps) =>
            ps.some((p) => p.id === (payload.new as Player).id)
              ? ps
              : [...ps, payload.new as Player],
          ),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "arcade_players", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setPlayers((ps) =>
            ps.map((p) =>
              p.id === (payload.new as Player).id ? { ...p, ...(payload.new as Player) } : p,
            ),
          ),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "arcade_subs", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setSubs((ss) =>
            ss.some((s) => s.id === (payload.new as Sub).id) ? ss : [...ss, payload.new as Sub],
          ),
      )
      .subscribe();
    // Backstop poll: Realtime very occasionally drops events on phone lock/unlock.
    const poll = setInterval(refresh, 5000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id]);

  return { room, players, subs, error, refresh };
}

// Countdown that starts when `key` changes (e.g. phase or round change).
export function useCountdown(key: string | number, seconds: number, active: boolean) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (!active) return;
    setLeft(seconds);
    const start = Date.now();
    const t = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - start) / 1000));
      setLeft(remaining);
      if (remaining <= 0) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active, seconds]);
  return left;
}
