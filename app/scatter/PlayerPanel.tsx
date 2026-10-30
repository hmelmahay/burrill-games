"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Sub, ScatterRound } from "@/lib/supabase";
import { useMaskedTyping } from "@/app/components/ui";

// A player's answer sheet for the current letter. Shared by the phone view and
// the host screen, so whoever runs the room can play on the same device. Keep
// it mounted through "judge": that's where an unsent sheet gets handed in.
// The host screen also passes `handInRef` so it can hand its own sheet in
// before it switches the room to judging.
export function PlayerPanel({
  room,
  subs,
  playerId,
  left,
  handInRef,
  conceal,
}: {
  room: Room;
  subs: Sub[];
  playerId: string;
  left: number;
  handInRef?: { current: (() => Promise<boolean>) | null };
  conceal?: boolean;
}) {
  const [answers, setAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [sent, setSent] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const sentRef = useRef(false);
  const pendingRef = useRef<Promise<boolean> | null>(null);
  const { inputClass, toggle } = useMaskedTyping(conceal);

  useEffect(() => {
    setAnswers(["", "", "", "", ""]);
    setSent(false);
    sentRef.current = false;
    pendingRef.current = null;
  }, [room.round_idx]);

  const round = room.rounds[room.round_idx] as ScatterRound | undefined;
  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;

  // Resolves true once the sheet is in (or already was), false if it failed.
  function handIn(): Promise<boolean> {
    if (sentRef.current || mySub) return pendingRef.current ?? Promise.resolve(true);
    sentRef.current = true;
    setSent(true);
    pendingRef.current = (async () => {
      const { error: e } = await supabase.from("arcade_subs").insert({
        room_id: room.id,
        player_id: playerId,
        round_idx: room.round_idx,
        payload: { answers: answersRef.current.map((a) => a.trim()) },
      });
      if (e && e.code !== "23505") {
        sentRef.current = false;
        setSent(false);
        return false;
      }
      return true;
    })();
    return pendingRef.current;
  }
  if (handInRef) handInRef.current = handIn;

  // Auto-hand-in when the clock hits zero (or judging starts before we sent).
  useEffect(() => {
    if (room.phase === "write" && left === 0) handIn();
    if (room.phase === "judge" && !sent && !mySub) handIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room.phase]);

  if (!round || room.phase !== "write") return null;

  if (locked)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
        <p className="text-3xl">📬</p>
        <p className="font-bold text-xl">Handed in!</p>
        <p className="text-fog">
          {/* Only the host screen passes handInRef, and that host has to start judging. */}
          {left === 0
            ? handInRef
              ? "✏️ Pencils down! Start judging below."
              : "✏️ Pencils down! Waiting for the host…"
            : "Waiting for the timer…"}
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {round.categories.map((cat, i) => (
        <label key={i} className="flex flex-col gap-1">
          <span className="text-sm font-semibold">{cat}</span>
          <input
            value={answers[i]}
            onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            className={`rounded-lg border border-line bg-card px-3 py-2.5 ${inputClass}`}
            placeholder={`${round.letter}…`}
          />
        </label>
      ))}
      <button onClick={handIn} className="coin-btn coin-glow mt-1">
        <span className="coin-face py-3.5 text-lg">Hand in early</span>
      </button>
      {toggle}
    </div>
  );
}
