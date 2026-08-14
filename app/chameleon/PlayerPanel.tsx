"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Player, Sub } from "@/lib/supabase";
import { WordGrid } from "@/app/chameleon/WordGrid";
import { ChamRound, ChamPhaseData } from "@/app/chameleon/constants";

// Everything a player *does* in Chameleon: learn your role, vote for who you
// think the chameleon is, and — if you're caught — pick the secret word.
// Shared by the phone view and the host screen. `conceal` hides the role
// behind a peek toggle for a host screen other people can see.
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
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    setSent(false);
    setPeeking(false);
  }, [room.round_idx, room.phase]);

  const rounds = (room.rounds ?? []) as ChamRound[];
  const round = rounds[room.round_idx];
  const phaseData = (room.phase_data ?? {}) as ChamPhaseData;
  const me = players.find((p) => p.id === playerId);
  const isChameleon = round?.chameleon_id === playerId;
  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const myVote = (mySub?.payload as { vote?: string } | undefined)?.vote;
  const myGuess = (mySub?.payload as { guess?: number } | undefined)?.guess;

  async function sendVote(targetId: string) {
    if (!playerId || sent || myVote != null) return;
    setSent(true);
    const { error } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { vote: targetId },
    });
    if (error && error.code !== "23505") setSent(false);
  }

  // The chameleon voted earlier this round, so the guess rides on the same
  // sub row (one sub per player per round) — update, not insert.
  async function sendGuess(idx: number) {
    if (!playerId || sent || myGuess != null) return;
    setSent(true);
    const { error } = mySub
      ? await supabase
          .from("arcade_subs")
          .update({ payload: { ...(mySub.payload ?? {}), guess: idx } })
          .eq("id", mySub.id)
      : await supabase.from("arcade_subs").insert({
          room_id: room.id,
          player_id: playerId,
          round_idx: room.round_idx,
          payload: { guess: idx },
        });
    if (error && error.code !== "23505") setSent(false);
  }

  if (!me || !round) return null;

  if (room.phase === "clue") {
    if (conceal && !peeking) {
      return (
        <div className="flex flex-col items-center gap-2 py-2">
          <p className="text-fog text-sm">Your role is hidden — others can see this screen.</p>
          <button
            onClick={() => setPeeking(true)}
            className="rounded-xl border-2 border-violet px-6 py-3 font-bold hover:bg-violet/10"
          >
            🫣 Tap to peek at your role
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        {isChameleon ? (
          <div className="rounded-2xl border-2 border-lose bg-lose/10 p-4 text-center">
            <div className="text-3xl">🦎</div>
            <div className="text-xl font-extrabold">You are the Chameleon!</div>
            <p className="text-fog text-sm mt-1">
              You don&apos;t know the secret word. When it&apos;s your turn, say a word
              that could fit — listen hard and blend in.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-win bg-win/10 p-4 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">The secret word is</div>
            <div className="text-2xl font-extrabold text-win">
              {round.words[round.secret_idx]}
            </div>
            <p className="text-fog text-sm mt-1">
              Say one related word out loud — close enough to prove you know it,
              vague enough that the chameleon can&apos;t steal it.
            </p>
          </div>
        )}
        <WordGrid words={round.words} highlightIdx={isChameleon ? null : round.secret_idx} />
        {conceal && (
          <button onClick={() => setPeeking(false)} className="text-fog text-sm underline">
            Hide my role again
          </button>
        )}
      </div>
    );
  }

  if (room.phase === "vote") {
    if (myVote != null || sent) {
      const voted = players.find((p) => p.id === myVote);
      return (
        <div className="flex flex-col items-center gap-1 py-4">
          <p className="text-3xl">🗳️</p>
          <p className="font-bold">You voted{voted ? ` for ${voted.name}` : ""}.</p>
          <p className="text-fog text-sm">Waiting for the rest of the room…</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold text-center">Who is the Chameleon?</h2>
        <div className="grid grid-cols-2 gap-2">
          {players
            .filter((p) => p.id !== playerId)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => sendVote(p.id)}
                className="rounded-xl border-2 border-line bg-card px-3 py-3.5 font-bold hover:border-lose truncate"
              >
                {p.name}
              </button>
            ))}
        </div>
        {isChameleon && (
          <p className="text-fog text-xs text-center">
            🦎 Vote like everyone else — pointing a finger keeps it off you.
          </p>
        )}
      </div>
    );
  }

  if (room.phase === "guess") {
    if (isChameleon) {
      if (myGuess != null || sent) {
        return (
          <div className="flex flex-col items-center gap-1 py-4">
            <p className="text-3xl">🤞</p>
            <p className="font-bold">Guess locked in…</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border-2 border-lose bg-lose/10 p-4 text-center">
            <div className="text-xl font-extrabold">🦎 You&apos;ve been caught!</div>
            <p className="text-fog text-sm mt-1">
              One way out: tap the secret word. Guess right and you still score.
            </p>
          </div>
          <WordGrid words={round.words} onPick={sendGuess} />
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-1 py-4">
        <p className="text-3xl">😬</p>
        <p className="font-bold">{round.chameleon_name} was caught!</p>
        <p className="text-fog text-sm">
          They&apos;re staring at the card, trying to guess the secret word…
        </p>
      </div>
    );
  }

  return null;
}
