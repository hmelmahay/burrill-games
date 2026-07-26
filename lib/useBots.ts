"use client";

import { useEffect, useRef, RefObject } from "react";
import { supabase, Room, Player, Sub } from "./supabase";
import { botsOf, botDelayMs } from "./bot-logic";

// Drives house bots for one game. While `active` (the phase that accepts
// submissions), every seated bot without a submission for this round files
// one after a humanlike pause.
//
// Runs only on the true host tab — /tv spectators pass their tvRef and do
// nothing, so bots never submit twice. Keyed off missing submissions, so a
// host refresh mid-round re-arms cleanly rather than stranding the round.
export function useBotSubmissions({
  room,
  players,
  roundSubs,
  active,
  tvRef,
  excludeId,
  makePayload,
  delayMs,
}: {
  room: Room | null;
  players: Player[];
  roundSubs: Sub[];
  active: boolean;
  tvRef: RefObject<boolean>;
  excludeId?: string;
  makePayload: (bot: Player) => Record<string, unknown>;
  // Override the thinking pause. Quiz Rush scores by arrival time, so its
  // bots need a delay tied to the answer window rather than the default.
  delayMs?: (bot: Player) => number;
}) {
  const scheduled = useRef(new Set<string>());
  // Read the latest payload builder without making it an effect dependency
  // (it is rebuilt every render, which would restart every bot's timer).
  const payloadRef = useRef(makePayload);
  const delayRef = useRef(delayMs);
  useEffect(() => {
    payloadRef.current = makePayload;
    delayRef.current = delayMs;
  });

  useEffect(() => {
    if (tvRef.current) return;
    if (!room || !active) return;
    const keys = scheduled.current;
    const timers: { t: ReturnType<typeof setTimeout>; key: string; fired: boolean }[] = [];

    for (const bot of botsOf(players)) {
      if (excludeId && bot.id === excludeId) continue;
      if (roundSubs.some((s) => s.player_id === bot.id)) continue;
      const key = `${room.round_idx}-${bot.id}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const entry = {
        key,
        fired: false,
        t: setTimeout(() => {
          entry.fired = true;
          supabase
            .from("arcade_subs")
            .insert({
              room_id: room.id,
              player_id: bot.id,
              round_idx: room.round_idx,
              payload: payloadRef.current(bot),
            })
            .then(({ error }) => {
              // 23505 = already submitted (double-fire race) — harmless.
              if (error && error.code !== "23505") keys.delete(key);
            });
        }, delayRef.current ? delayRef.current(bot) : botDelayMs()),
      };
      timers.push(entry);
    }

    return () =>
      timers.forEach((e) => {
        clearTimeout(e.t);
        // Release unfired keys so a re-render reschedules instead of
        // stranding the bot and hanging the round.
        if (!e.fired) keys.delete(e.key);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.round_idx, active, players.length, roundSubs.length, excludeId]);
}
