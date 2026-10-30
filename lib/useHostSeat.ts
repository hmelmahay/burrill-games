"use client";

import { useEffect, useState } from "react";
import { supabase, Player, GameKind } from "./supabase";
import { joinRoom, playerKey } from "./rooms";
import { useSpectator } from "./useSpectator";

// The host screen doubles as a player's screen: whoever runs it can take a
// seat — from the setup page or the lobby — and play on this same device
// instead of signing in again somewhere else. A ?tv=1 copy never plays.
export function useHostSeat(
  game: GameKind,
  code: string,
  players: Player[],
  refresh?: () => unknown,
  playersLoaded = true,
) {
  const { tv, tvRef } = useSpectator();
  const [playerId, setPlayerId] = useState<string | null>(null);
  // The row joinRoom handed back. It stands in for `me` until the room's player
  // list catches up, so the lobby card can't flip back to "Join here" and seat
  // the host a second time while the Realtime echo is still on its way.
  const [seated, setSeated] = useState<Player | null>(null);
  useEffect(() => {
    if (tvRef.current) return;
    try {
      setPlayerId(localStorage.getItem(playerKey(code)));
    } catch {
      // Site storage is blocked (some TV and privacy setups): start unseated.
    }
  }, [code, tvRef]);
  const me =
    players.find((p) => p.id === playerId) ?? (seated?.id === playerId ? seated : null);
  // This device holds a seat for the room but the player list hasn't arrived:
  // don't offer "Join here" yet, or a quick tap could seat the host twice.
  const checking = !!playerId && !me && !playersLoaded;

  async function sit(name: string): Promise<string | null> {
    if (me || checking) return null;
    const n = name.trim();
    if (!n) return "Enter your name first.";
    const { player, error } = await joinRoom(game, code, n);
    if (error || !player) return error ?? "Couldn't seat you.";
    try {
      localStorage.setItem(playerKey(code), player.id);
    } catch {}
    setSeated(player);
    setPlayerId(player.id);
    refresh?.();
    return null;
  }

  // Lobby only: once a game starts, rounds are built around the seated players.
  async function leave(): Promise<string | null> {
    if (!me) return null;
    const { error } = await supabase.from("arcade_players").delete().eq("id", me.id);
    if (error) return error.message;
    try {
      localStorage.removeItem(playerKey(code));
    } catch {}
    setSeated(null);
    setPlayerId(null);
    await refresh?.();
    return null;
  }

  return { playerId, me, checking, canPlay: !!me && !tv, tv, sit, leave };
}

export type HostSeat = ReturnType<typeof useHostSeat>;
