"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Player, Sub } from "@/lib/supabase";
import { VibeRound, VibePhaseData } from "@/app/vibe/constants";

// Everything a player *does* in Vibe Check: write a clue when you're the
// psychic, slide a dial when you're not. Shared by the phone view and the
// host screen, so whoever created the room can play on the same device
// instead of being locked out of their own game.
export function PlayerPanel({
  room,
  players,
  subs,
  playerId,
}: {
  room: Room;
  players: Player[];
  subs: Sub[];
  playerId: string;
}) {
  const [clue, setClue] = useState("");
  const [dial, setDial] = useState(50);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setClue("");
    setDial(50);
    setSent(false);
  }, [room.round_idx]);

  const rounds = (room.rounds ?? []) as VibeRound[];
  const round = rounds[room.round_idx];
  const phaseData = (room.phase_data ?? {}) as VibePhaseData;
  const me = players.find((p) => p.id === playerId);
  const isPsychic = round?.psychic_id === playerId;
  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;

  async function sendClue() {
    if (!playerId || locked || !clue.trim()) return;
    setSent(true);
    const { error } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { clue: clue.trim() },
    });
    if (error && error.code !== "23505") setSent(false);
  }

  async function sendGuess() {
    if (!playerId || locked || isPsychic) return;
    setSent(true);
    const { error } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: dial },
    });
    if (error && error.code !== "23505") setSent(false);
  }

  if (!me || !round) return null;

  if (room.phase === "clue" && isPsychic && !locked) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold text-center">🔮 You&apos;re the psychic!</h2>
        <div className="flex justify-between font-bold">
          <span>← {round.left}</span>
          <span>{round.right} →</span>
        </div>
        <div className="relative h-6 rounded-full bg-gradient-to-r from-violet to-glow">
          <div
            className="absolute top-[-6px] bottom-[-6px] w-2 bg-win rounded"
            style={{ left: `calc(${round.target}% - 4px)` }}
          />
        </div>
        <p className="text-fog text-sm text-center">
          Your secret spot is the green line ({round.target}/100). Write a clue that points
          there — without saying the scale words.
        </p>
        <input
          value={clue}
          onChange={(e) => setClue(e.target.value)}
          placeholder="Your clue… (e.g. 'leftover pizza')"
          maxLength={60}
          autoComplete="off"
          className="rounded-xl border-2 border-glow bg-card px-4 py-4 text-lg"
          onKeyDown={(e) => e.key === "Enter" && sendClue()}
        />
        <button
          onClick={sendClue}
          disabled={!clue.trim()}
          className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
        >
          Send clue
        </button>
      </div>
    );
  }

  if (room.phase === "clue" && isPsychic && locked) {
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <p className="text-3xl">📡</p>
        <p className="font-bold">Clue sent!</p>
      </div>
    );
  }

  if (room.phase === "guess" && isPsychic) {
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <p className="text-3xl">👀</p>
        <p className="font-bold">They&apos;re reading your mind…</p>
        <p className="text-fog text-sm">+150 for every dial that lands near your spot.</p>
      </div>
    );
  }

  if (room.phase === "guess" && !isPsychic) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl bg-card border-2 border-glow p-4 text-center">
          <div className="text-fog text-xs uppercase tracking-widest">
            {round.psychic_name}&apos;s clue
          </div>
          <div className="text-xl font-extrabold">“{phaseData.clue}”</div>
        </div>
        <div className="flex justify-between font-bold">
          <span>← {round.left}</span>
          <span>{round.right} →</span>
        </div>
        {!locked ? (
          <>
            <input
              type="range"
              min={0}
              max={100}
              value={dial}
              onChange={(e) => setDial(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-center font-mono text-3xl font-bold">{dial}</div>
            <button
              onClick={sendGuess}
              className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg"
            >
              Lock in {dial}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 py-4">
            <p className="font-bold text-2xl font-mono">
              🔒 {(mySub?.payload as { guess?: number } | undefined)?.guess ?? dial}
            </p>
            <p className="text-fog">Waiting for everyone…</p>
          </div>
        )}
      </div>
    );
  }

  return null;
}
