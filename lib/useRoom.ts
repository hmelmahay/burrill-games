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
  // False until the first good players read, so "my seat isn't in the list"
  // can be told apart from "the list hasn't loaded yet".
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const roomIdRef = useRef<string | null>(null);

  // Resolves false when a read failed and is worth retrying.
  async function refresh(): Promise<boolean> {
    const { data: r, error: rErr } = await supabase
      .from("arcade_rooms")
      .select("*")
      .eq("code", code)
      .eq("game", game)
      .maybeSingle();
    // A failed read is a network blip, not a missing room: keep the last good
    // state rather than stranding the screen on "Room not found".
    if (rErr) return false;
    if (!r) {
      setError("Room not found.");
      return true;
    }
    setError(null);
    const rm = r as Room;
    roomIdRef.current = rm.id;
    setRoom(rm);
    const [{ data: ps, error: pErr }, { data: ss, error: sErr }] = await Promise.all([
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
    // Same for the lists: an empty players list would make every screen think
    // its own player left, unmounting whatever they were halfway through typing.
    if (!pErr && ps) {
      setPlayers(ps as Player[]);
      setPlayersLoaded(true);
    }
    if (!sErr && ss) setSubs(ss as Sub[]);
    return !pErr && !sErr;
  }

  // The first load retries until the room row arrives; after that the Realtime
  // channel and the backstop poll below keep everything current.
  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    roomIdRef.current = null;
    const load = async () => {
      const ok = await refresh();
      if (!ok && !stopped && !roomIdRef.current) retry = setTimeout(load, 3000);
    };
    load();
    return () => {
      stopped = true;
      if (retry) clearTimeout(retry);
    };
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
        // Removing a bot or giving up a host seat deletes a player row; drop it
        // now, not at the next poll, so a quick Start can't seat a ghost.
        // (Same unfiltered-DELETE caveat as arcade_subs below.)
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "arcade_players" },
        (payload) =>
          setPlayers((ps) => ps.filter((p) => p.id !== (payload.old as { id: string }).id)),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "arcade_subs", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setSubs((ss) =>
            ss.some((s) => s.id === (payload.new as Sub).id) ? ss : [...ss, payload.new as Sub],
          ),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "arcade_subs", filter: `room_id=eq.${roomId}` },
        (payload) =>
          setSubs((ss) =>
            ss.map((s) =>
              s.id === (payload.new as Sub).id ? { ...s, ...(payload.new as Sub) } : s,
            ),
          ),
      )
      .on(
        // Answer-changing deletes + reinserts; drop the old row locally.
        // (Realtime can't filter DELETEs by room_id — matching by id is safe.)
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "arcade_subs" },
        (payload) =>
          setSubs((ss) => ss.filter((s) => s.id !== (payload.old as { id: string }).id)),
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

  return { room, players, subs, error, refresh, playersLoaded };
}

// Countdown that restarts when `key` changes (e.g. phase or round change).
// The clock resets during render via a ref comparison — not in an effect — so
// a rapid phase→phase transition can never leave it stuck at a stale value.
// The interval exists only to force re-renders; `left` is derived on the spot.
export function useCountdown(key: string | number, seconds: number, active: boolean) {
  const keyRef = useRef(key);
  const startRef = useRef(Date.now());
  if (keyRef.current !== key) {
    keyRef.current = key;
    startRef.current = Date.now();
  }
  const [, force] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [active, key]);
  if (!active) return seconds;
  return Math.max(0, seconds - Math.floor((Date.now() - startRef.current) / 1000));
}
