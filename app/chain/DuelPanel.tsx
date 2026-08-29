"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Player, ChainRound } from "@/lib/supabase";
import {
  chainGuessOk,
  wordValue,
  DuelState,
  HIDDEN_WORDS,
} from "./constants";

// The active player's guess box in a duel. Unlike most games the state
// transition runs here, not on the host screen: only the player whose turn it
// is renders this, so there's exactly one writer and a guess lands with no
// host round-trip. A hit keeps the turn; a miss or pass reveals one more
// letter of the stuck word and hands the turn over. The answers live in
// room.rounds like every other game — this device just applies the rules.
export function DuelPanel({
  room,
  round,
  players,
  me,
  duel,
}: {
  room: Room;
  round: ChainRound;
  players: Player[];
  me: Player;
  duel: DuelState;
}) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setGuess("");
    inputRef.current?.focus();
  }, [duel.solved, duel.reveal, duel.turn]);

  const target = round.words[duel.solved + 1] as string | undefined;
  if (!target) return null;
  const worth = wordValue(duel.reveal, target.length);
  const rival = players.find((p) => p.id !== me.id);

  async function apply(next: DuelState, done: boolean) {
    await supabase
      .from("arcade_rooms")
      .update(done ? { phase: "reveal", phase_data: { duel: next } } : { phase_data: { duel: next } })
      .eq("id", room.id);
  }

  async function submit(pass: boolean) {
    if (busy || !target) return;
    const g = guess.trim();
    if (!pass && !g) return;
    setBusy(true);
    if (!pass && chainGuessOk(g, target)) {
      // Hit: bank the points, keep the turn.
      await supabase
        .from("arcade_players")
        .update({ score: me.score + worth })
        .eq("id", me.id);
      const solved = duel.solved + 1;
      await apply(
        { solved, reveal: 1, turn: me.id, last: { name: me.name, word: target, kind: "hit" } },
        solved >= HIDDEN_WORDS,
      );
    } else {
      // Miss or pass: one more letter shows, opponent takes over. If that
      // letter was the last one hidden, the word is given away for nothing.
      const reveal = duel.reveal + 1;
      const turn = rival?.id ?? me.id;
      if (reveal >= target.length) {
        const solved = duel.solved + 1;
        await apply(
          { solved, reveal: 1, turn, last: { name: me.name, word: target, kind: "given" } },
          solved >= HIDDEN_WORDS,
        );
      } else {
        await apply(
          {
            solved: duel.solved,
            reveal,
            turn,
            last: { name: me.name, word: pass ? "passed" : g, kind: "miss" },
          },
          false,
        );
      }
    }
    setGuess("");
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-center font-bold text-violet">
        Your turn, {me.name} — worth {worth} pts
      </p>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(false)}
          placeholder="Your guess…"
          disabled={busy}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          className="flex-1 rounded-xl border-2 border-glow bg-card px-3 py-3 font-mono uppercase tracking-widest"
        />
        <button
          onClick={() => submit(false)}
          disabled={busy || !guess.trim()}
          className="rounded-xl bg-glow text-[#1a1000] px-5 font-bold disabled:opacity-40"
        >
          Go
        </button>
      </div>
      <button
        onClick={() => submit(true)}
        disabled={busy}
        className="self-center rounded-lg border border-line px-4 py-1.5 text-sm font-semibold text-fog hover:border-lose disabled:opacity-40"
      >
        Pass — reveal a letter, {rival ? `${rival.name}'s` : "their"} turn
      </button>
      <p className="text-fog text-xs text-center">
        A wrong guess also reveals a letter and hands over the turn.
      </p>
    </div>
  );
}
