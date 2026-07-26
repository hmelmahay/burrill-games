"use client";

import { useEffect, useState, RefObject } from "react";
import { Room } from "./supabase";

// Asks the server what a bot should answer this round, once per round, before
// any bot submits. Bots are never handed the secret target or the correct
// answer, so this is the only way they can play honestly.
//
// `ready` goes true once the round has an answer to work from — callers gate
// their bots on it. `answer` is null when the service is unavailable, which
// means bots must guess blind rather than fall back to peeking.
export function useBotAnswer<T extends Record<string, number>>({
  room,
  active,
  tvRef,
  ask,
}: {
  room: Room | null;
  active: boolean;
  tvRef: RefObject<boolean>;
  ask: Record<string, unknown> | null;
}): { ready: boolean; answer: T | null } {
  const [state, setState] = useState<{ round: number; roomId: string; answer: T | null } | null>(
    null,
  );

  useEffect(() => {
    if (tvRef.current) return;
    if (!room || !active || !ask) return;
    if (state?.roomId === room.id && state.round === room.round_idx) return;

    let cancelled = false;
    const settle = (answer: T | null) => {
      if (!cancelled) setState({ round: room.round_idx, roomId: room.id, answer });
    };

    fetch("/api/bots/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ask),
    })
      .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
      .then(settle)
      .catch(() => settle(null));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.round_idx, active, JSON.stringify(ask)]);

  const ready = !!room && state?.roomId === room.id && state.round === room.round_idx;
  return { ready, answer: ready ? (state?.answer ?? null) : null };
}
