"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Sub } from "@/lib/supabase";
import { BigBtn, useMaskedTyping } from "@/app/components/ui";
import { Stamp } from "@/app/components/fx";

// A player's number guess for the current question. Shared by the phone view
// and the host screen, so whoever runs the room can play on the same device.
// `conceal` (host screen) keeps the locked-in number off a screen others see.
export function PlayerPanel({
  room,
  subs,
  playerId,
  conceal,
}: {
  room: Room;
  subs: Sub[];
  playerId: string;
  conceal?: boolean;
}) {
  const [guess, setGuess] = useState("");
  const [sent, setSent] = useState(false);
  const { inputClass, toggle } = useMaskedTyping(conceal);

  useEffect(() => {
    setGuess("");
    setSent(false);
  }, [room.round_idx]);

  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;

  async function submit() {
    const num = Number(guess.replace(/[,\s]/g, ""));
    if (locked || !guess.trim() || !isFinite(num)) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: num },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (!locked)
    return (
      <div className="flex flex-col gap-4">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value.replace(/[^0-9.,-]/g, ""))}
          placeholder="Your number…"
          inputMode="decimal"
          autoComplete="off"
          className={`rounded-xl border-2 border-glow bg-card px-4 py-4 text-2xl text-center font-mono ${inputClass}`}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <BigBtn onClick={submit} disabled={!guess.trim()}>
          Lock it in
        </BigBtn>
        {toggle}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2 py-6">
      {conceal ? (
        <p className="font-bold text-2xl font-mono">🔒 Locked in</p>
      ) : (
        <>
          <Stamp tone="violet">Locked in</Stamp>
          <p className="font-bold text-2xl font-mono tabular-nums">
            {mySub ? Number(mySub.payload.guess).toLocaleString() : guess}
          </p>
        </>
      )}
      <p className="text-fog">Waiting for everyone…</p>
    </div>
  );
}
