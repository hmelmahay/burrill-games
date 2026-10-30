"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Sub, MajorityRound } from "@/lib/supabase";

// A player's vote + prediction for the current round. Shared by the phone view
// and the host screen, so whoever runs the room can play on the same device.
// `conceal` (host screen) keeps the locked-in picks off a screen others see.
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
  const [vote, setVote] = useState<"a" | "b" | null>(null);
  const [pred, setPred] = useState<"a" | "b" | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setVote(null);
    setPred(null);
    setSent(false);
  }, [room.round_idx]);

  const round = room.rounds[room.round_idx] as MajorityRound | undefined;
  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;
  // After a refresh the local picks are gone; the submission still has them.
  const shownVote = vote ?? (mySub?.payload.vote as "a" | "b" | undefined) ?? null;
  const shownPred = pred ?? (mySub?.payload.pred as "a" | "b" | undefined) ?? null;

  async function submit(v: "a" | "b", p: "a" | "b") {
    if (locked) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { vote: v, pred: p },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (!round) return null;

  if (locked)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-3xl">🔒</p>
        <p className="font-bold text-xl">Locked in!</p>
        {!conceal && (
          <p className="text-fog text-sm text-center">
            You picked {shownVote === "a" ? round.a : shownVote === "b" ? round.b : "…"} and
            predicted the room goes{" "}
            {shownPred === "a" ? round.a : shownPred === "b" ? round.b : "…"}.
          </p>
        )}
        <p className="text-fog">Waiting for everyone…</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="font-bold text-center text-lg">1 · Your pick?</h2>
        <button
          onClick={() => setVote("a")}
          className={`rounded-xl p-4 font-bold text-lg bg-glow text-[#1a1000] ${
            vote === "a" ? "ring-4 ring-white" : vote ? "opacity-40" : ""
          }`}
        >
          {round.a}
        </button>
        <button
          onClick={() => setVote("b")}
          className={`rounded-xl p-4 font-bold text-lg bg-violet text-white ${
            vote === "b" ? "ring-4 ring-white" : vote ? "opacity-40" : ""
          }`}
        >
          {round.b}
        </button>
      </div>
      {vote && (
        <div className="flex flex-col gap-2 pop-in">
          <h2 className="font-bold text-center text-lg">
            2 · What will the <span className="underline">majority</span> pick?
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setPred("a");
                submit(vote, "a");
              }}
              className="rounded-xl p-4 font-bold bg-glow/80 text-[#1a1000]"
            >
              {round.a}
            </button>
            <button
              onClick={() => {
                setPred("b");
                submit(vote, "b");
              }}
              className="rounded-xl p-4 font-bold bg-violet/80 text-white"
            >
              {round.b}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
