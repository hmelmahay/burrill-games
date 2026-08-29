"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Player, ChainRound } from "@/lib/supabase";
import {
  chainGuessOk,
  wordValue,
  DuelState,
  FRESH_SIDE,
  HIDDEN_WORDS,
  WIN_BONUS,
} from "./constants";

// The active player's guess box in a duel. Each player chases their OWN chain;
// only the turn is shared. Unlike most games the state transition runs here,
// not on the host screen: exactly one device may act at a time (the host's
// shot clock is the only other writer), so a guess lands with no host
// round-trip. A hit keeps the turn; a miss or pass reveals one more letter of
// MY stuck word — easier for me next turn — and hands the turn over. First to
// the bottom of their own chain wins the round.
export function DuelPanel({
  room,
  myRound,
  players,
  me,
  duel,
}: {
  room: Room;
  myRound: ChainRound; // this player's own chain
  players: Player[];
  me: Player;
  duel: DuelState;
}) {
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const side = duel.sides[me.id] ?? FRESH_SIDE;
  useEffect(() => {
    setGuess("");
    inputRef.current?.focus();
  }, [side.solved, side.reveal, duel.turn]);

  const target = myRound.words[side.solved + 1] as string | undefined;
  if (!target) return null;
  const worth = wordValue(side.reveal, target.length);
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
      // Hit: bank the points, keep the turn. Finishing my chain ends the round.
      const solved = side.solved + 1;
      const won = solved >= HIDDEN_WORDS;
      await supabase
        .from("arcade_players")
        .update({ score: me.score + worth + (won ? WIN_BONUS : 0) })
        .eq("id", me.id);
      await apply(
        {
          sides: { ...duel.sides, [me.id]: { solved, reveal: 1 } },
          turn: me.id,
          last: { name: me.name, word: target, kind: "hit" },
          winner: won ? me.id : null,
        },
        won,
      );
    } else {
      // Miss or pass: one more of MY letters shows, rival takes over. If that
      // letter was the last one hidden, the word is given to me for nothing.
      const reveal = side.reveal + 1;
      const turn = rival?.id ?? me.id;
      if (reveal >= target.length) {
        const solved = side.solved + 1;
        const won = solved >= HIDDEN_WORDS; // limping over the line still wins
        await apply(
          {
            sides: { ...duel.sides, [me.id]: { solved, reveal: 1 } },
            turn,
            last: { name: me.name, word: target, kind: "given" },
            winner: won ? me.id : null,
          },
          won,
        );
      } else {
        await apply(
          {
            sides: { ...duel.sides, [me.id]: { solved: side.solved, reveal } },
            turn,
            last: { name: me.name, word: pass ? "passed" : g, kind: "miss" },
            winner: null,
          },
          false,
        );
      }
    }
    setGuess("");
    setBusy(false);
  }

  return (
    // Sticky: the guess box rides the bottom of the screen while the chain
    // scrolls, so a phone never has to scroll down to type.
    <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 rounded-t-xl bg-ink/95 px-1 pt-2 pb-2 backdrop-blur">
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
        Pass — show one of my letters, {rival ? `${rival.name}'s` : "their"} turn
      </button>
      <p className="text-fog text-xs text-center">
        A wrong guess (or the clock) also shows a letter and hands over the turn.
      </p>
    </div>
  );
}
