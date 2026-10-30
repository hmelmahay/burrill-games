"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Player, Sub } from "@/lib/supabase";

// A player's vote for this round's "most likely to". Shared by the phone view
// and the host screen, so whoever runs the room can play on the same device
// (and lands on the ballot like everyone else). `conceal` (host screen) keeps
// the locked-in vote off a screen others see.
export function PlayerPanel({
  room,
  players,
  subs,
  playerId,
  conceal,
}: {
  room: Room;
  players: Player[];
  subs: Sub[];
  playerId: string;
  conceal?: boolean;
}) {
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setSent(false);
  }, [room.round_idx]);

  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;
  const myTarget = (mySub?.payload as { target?: string } | undefined)?.target;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  async function vote(targetId: string) {
    if (locked) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { target: targetId },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (!locked)
    return (
      <div className="grid grid-cols-2 gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => vote(p.id)}
            className={`rounded-xl p-4 font-bold border-2 border-line bg-card active:scale-95 transition ${
              p.id === playerId ? "border-violet" : ""
            }`}
          >
            {p.name}
            {p.id === playerId ? " (me!)" : ""}
          </button>
        ))}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2 py-6">
      <p className="font-bold text-xl">
        {conceal ? "🔒 Vote locked in" : `🔒 You said ${myTarget ? nameOf(myTarget) : "…"}`}
      </p>
      <p className="text-fog">Waiting for everyone…</p>
    </div>
  );
}
