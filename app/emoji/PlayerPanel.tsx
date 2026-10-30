"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Sub } from "@/lib/supabase";
import { useMaskedTyping } from "@/app/components/ui";

// A player's guess box for the current puzzle. Shared by the phone view and
// the host screen, so whoever runs the room can play on the same device.
// `conceal` (host screen) keeps the locked-in guess off a screen others see.
export function PlayerPanel({
  room,
  subs,
  playerId,
  left,
  conceal,
}: {
  room: Room;
  subs: Sub[];
  playerId: string;
  left: number;
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
    if (locked || !guess.trim()) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: guess.trim() },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (!locked && left > 0)
    return (
      <div className="flex flex-col gap-4">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="Your guess…"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={60}
          className={`rounded-xl border-2 border-glow bg-card px-4 py-4 text-lg ${inputClass}`}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button onClick={submit} disabled={!guess.trim()} className="coin-btn coin-glow disabled:opacity-40">
          <span className="coin-face py-4 text-lg">Lock it in</span>
        </button>
        {toggle}
      </div>
    );

  return (
    <div className="flex flex-col items-center gap-2 py-6">
      {locked ? (
        <>
          <p className="font-bold text-xl">
            {conceal ? "🔒 Locked in" : `🔒 “${mySub ? String(mySub.payload.guess) : guess}”`}
          </p>
          <p className="text-fog">Waiting for everyone…</p>
        </>
      ) : (
        <p className="text-fog text-xl">⏰ Time&apos;s up!</p>
      )}
    </div>
  );
}
