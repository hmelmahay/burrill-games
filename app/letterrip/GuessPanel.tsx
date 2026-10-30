"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Sub, LetterRound } from "@/lib/supabase";
import {
  Claim,
  GuessPayload,
  LetterGuess,
  matchIdx,
  slotPoints,
} from "./constants";

// One player's guess box. Every guess is appended to this player's
// arcade_subs payload for the round — the board itself is derived from those
// rows on every screen, so the panel only writes and gives instant local
// feedback (the authoritative claim can still go to a faster phone).
// Used by the phone view and inline on the host screen when the creator plays.

type Flash = { kind: "hit" | "dupe" | "miss"; text: string } | null;

export function GuessPanel({
  room,
  round,
  playerId,
  subs,
  phase,
  found,
  disabled,
  disabledNote,
}: {
  room: Room;
  round: LetterRound;
  playerId: string;
  subs: Sub[];
  phase: "solve" | "steal";
  found: (Claim | null)[];
  disabled?: boolean;
  disabledNote?: string;
}) {
  const [guess, setGuess] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const guessesRef = useRef<LetterGuess[]>([]);
  const subIdRef = useRef<string | null>(null);
  const roundRef = useRef(room.round_idx);
  const inputRef = useRef<HTMLInputElement>(null);

  // New board: start clean.
  useEffect(() => {
    if (roundRef.current === room.round_idx) return;
    roundRef.current = room.round_idx;
    subIdRef.current = null;
    guessesRef.current = [];
    setGuess("");
    setFlash(null);
  }, [room.round_idx]);

  // Rehydrate after a refresh: adopt our row's id and union its guesses in.
  useEffect(() => {
    const mine = subs.find(
      (s) => s.player_id === playerId && s.round_idx === room.round_idx,
    );
    if (!mine) return;
    subIdRef.current = mine.id;
    const server = (mine.payload as Partial<GuessPayload>)?.guesses ?? [];
    const seen = new Set(guessesRef.current.map((g) => `${g.t}|${g.g}`));
    for (const g of server) {
      if (!seen.has(`${g.t}|${g.g}`)) guessesRef.current.push(g);
    }
  }, [subs, room.round_idx, playerId]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(t);
  }, [flash]);

  // Persists run one at a time: a second Enter while the first insert is in
  // flight must not race it into a duplicate-row 23505 that drops the guess.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  function persist() {
    chainRef.current = chainRef.current.then(doPersist, doPersist);
  }

  async function doPersist() {
    const payload = { guesses: guessesRef.current } as unknown as Record<
      string,
      unknown
    >;
    if (subIdRef.current) {
      await supabase
        .from("arcade_subs")
        .update({ payload })
        .eq("id", subIdRef.current);
    } else {
      const { data, error } = await supabase
        .from("arcade_subs")
        .insert({
          room_id: room.id,
          player_id: playerId,
          round_idx: room.round_idx,
          payload,
        })
        .select()
        .single();
      if (!error && data) subIdRef.current = (data as Sub).id;
      // 23505 = our row already exists (a racing tab made it) — the
      // rehydrate effect adopts it on the next subs tick.
    }
  }

  function submit() {
    const g = guess.trim();
    if (!g || disabled) return;
    setGuess("");
    inputRef.current?.focus();
    // Local feedback only — the derived board is the referee.
    const idx = matchIdx(g, round, found);
    if (idx >= 0) {
      setFlash({
        kind: "hit",
        text: `✓ ${round.answers[idx].a.toUpperCase()} — ${slotPoints(idx)} pts!`,
      });
    } else if (matchIdx(g, round, round.answers.map(() => null)) >= 0) {
      setFlash({ kind: "dupe", text: "Already on the board!" });
    } else {
      setFlash({ kind: "miss", text: "✗ Not on the board" });
      return; // no point shipping obvious misses
    }
    guessesRef.current.push({ g, t: Date.now(), ph: phase });
    persist();
  }

  if (disabled) {
    return (
      <p className="text-center text-fog text-sm">
        {disabledNote ?? "Sit tight…"}
      </p>
    );
  }

  return (
    // Sticky: the guess box rides the bottom of the screen while the board
    // scrolls, so a phone never has to scroll down to type.
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-1.5 rounded-t-xl bg-ink/95 px-1 pt-2 pb-2 backdrop-blur">
      <div className="h-5 text-center text-sm font-bold">
        {flash && (
          <span
            className={`pop-in ${
              flash.kind === "hit"
                ? "text-win"
                : flash.kind === "dupe"
                  ? "text-fog"
                  : "text-lose"
            }`}
          >
            {flash.text}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={phase === "steal" ? "Steal an answer…" : "Guess an answer…"}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="flex-1 rounded-xl border-2 border-glow bg-card px-3 py-3 font-mono uppercase tracking-wider"
        />
        <button
          onClick={submit}
          disabled={!guess.trim()}
          className="rounded-xl bg-glow px-5 font-bold text-[#1a1000] disabled:opacity-40"
        >
          Go
        </button>
      </div>
    </div>
  );
}
