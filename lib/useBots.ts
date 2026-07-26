"use client";

import { useEffect, useRef, RefObject } from "react";
import { supabase, Room, Player, Sub } from "./supabase";
import { botsOf, botDelayMs } from "./bot-logic";

// Drives house bots for one game. While `active` (the phase that accepts
// submissions), every seated bot without a submission files one after a
// humanlike pause.
//
// Runs only on the true host tab — /tv spectators pass their tvRef and do
// nothing, so bots never submit twice.
//
// Pending timers deliberately survive re-renders. An earlier version cleared
// them in the effect cleanup, so every other player's submission cancelled
// and rescheduled the waiting bots with fresh delays. In Quiz Rush, where the
// pause is sized to the answer clock, that pushed bots past the deadline and
// they never answered at all. Timers are now torn down only when the round or
// phase actually turns over.
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
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Read the latest callbacks without making them effect dependencies (they
  // are rebuilt every render, which would restart every bot's timer).
  const payloadRef = useRef(makePayload);
  const delayRef = useRef(delayMs);
  useEffect(() => {
    payloadRef.current = makePayload;
    delayRef.current = delayMs;
  });

  const roundKey = `${room?.id ?? ""}-${room?.round_idx ?? -1}-${active}`;

  // Tear down pending timers when the round or phase turns over (or unmount).
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
      map.clear();
    };
  }, [roundKey]);

  useEffect(() => {
    if (tvRef.current) return;
    if (!room || !active) return;
    const map = timers.current;

    for (const bot of botsOf(players)) {
      if (excludeId && bot.id === excludeId) continue;
      const key = `${room.round_idx}-${bot.id}`;
      if (map.has(key)) continue; // already counting down
      if (roundSubs.some((s) => s.player_id === bot.id)) continue; // already in
      map.set(
        key,
        setTimeout(
          () => {
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
                // Anything else: drop the key so the bot gets another shot
                // rather than silently hanging the round.
                if (error && error.code !== "23505") map.delete(key);
              });
          },
          delayRef.current ? delayRef.current(bot) : botDelayMs(),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, players.length, roundSubs.length, excludeId]);
}
