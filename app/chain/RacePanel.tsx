"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, Room, Sub, ChainRound } from "@/lib/supabase";
import { ChainBoard } from "./ChainBoard";
import {
  chainGuessOk,
  wordValue,
  HIDDEN_WORDS,
  RaceProgress,
} from "./constants";

const MISS_LOCK_MS = 3000;

type Progress = RaceProgress & { reveal: number };

const fresh = (): Progress => ({ solved: 0, score: 0, hints: 0, done: false, reveal: 1 });

// One player's race view: their own copy of the chain, a guess box, and a
// buy-a-letter hint button. Progress persists to this player's arcade_subs row
// so a refresh rehydrates and the host can score the round. Used by the phone
// view and inline on the host screen when the room creator plays.
export function RacePanel({
  room,
  round,
  playerId,
  subs,
  left,
}: {
  room: Room;
  round: ChainRound;
  playerId: string;
  subs: Sub[];
  left: number;
}) {
  const [prog, setProg] = useState<Progress>(fresh);
  const [guess, setGuess] = useState("");
  const [lockUntil, setLockUntil] = useState(0);
  const [, tick] = useState(0);
  const subIdRef = useRef<string | null>(null);
  const roundRef = useRef<number>(room.round_idx);
  const inputRef = useRef<HTMLInputElement>(null);

  // New chain: start clean.
  useEffect(() => {
    if (roundRef.current === room.round_idx) return;
    roundRef.current = room.round_idx;
    subIdRef.current = null;
    setProg(fresh());
    setGuess("");
    setLockUntil(0);
  }, [room.round_idx]);

  // Rehydrate: whenever our row for this chain is visible, adopt its id (it
  // may arrive after mount, or change ids on the finish reinsert) and its
  // progress if it's ahead of local state — a refresh resumes where we were.
  useEffect(() => {
    const mine = subs.find(
      (s) => s.player_id === playerId && s.round_idx === room.round_idx,
    );
    if (!mine) return;
    subIdRef.current = mine.id;
    const p = { ...fresh(), ...(mine.payload as Partial<Progress>) };
    setProg((prev) =>
      p.solved > prev.solved || (p.solved === prev.solved && p.reveal > prev.reveal)
        ? p
        : prev,
    );
  }, [subs, room.round_idx, playerId]);

  // Re-render while locked out so the countdown label stays live.
  useEffect(() => {
    if (Date.now() >= lockUntil) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [lockUntil]);

  async function persist(p: Progress) {
    const row = {
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: p as unknown as Record<string, unknown>,
    };
    if (p.done && subIdRef.current) {
      // Delete + reinsert so created_at is the server-stamped finish time —
      // the host orders finishers by it (same trick as Quiz Rush re-timing).
      await supabase.from("arcade_subs").delete().eq("id", subIdRef.current);
      subIdRef.current = null;
    }
    if (subIdRef.current) {
      await supabase.from("arcade_subs").update({ payload: row.payload }).eq("id", subIdRef.current);
    } else {
      const { data, error } = await supabase.from("arcade_subs").insert(row).select().single();
      if (!error && data) subIdRef.current = (data as Sub).id;
    }
  }

  const target = round.words[prog.solved + 1] as string | undefined;
  const locked = Date.now() < lockUntil;
  const over = left === 0 || prog.done;

  function submit() {
    const g = guess.trim();
    if (!g || !target || locked || over) return;
    if (chainGuessOk(g, target)) {
      const gained = wordValue(prog.reveal, target.length);
      const solved = prog.solved + 1;
      const next: Progress = {
        solved,
        score: prog.score + gained,
        hints: prog.hints,
        reveal: 1,
        done: solved >= HIDDEN_WORDS,
      };
      setProg(next);
      setGuess("");
      persist(next);
      inputRef.current?.focus();
    } else {
      setGuess("");
      setLockUntil(Date.now() + MISS_LOCK_MS);
    }
  }

  function hint() {
    if (!target || locked || over) return;
    const reveal = prog.reveal + 1;
    if (reveal >= target.length) {
      // Whole word bought — it's solved for nothing, chain moves on.
      const solved = prog.solved + 1;
      const next: Progress = {
        solved,
        score: prog.score,
        hints: prog.hints + 1,
        reveal: 1,
        done: solved >= HIDDEN_WORDS,
      };
      setProg(next);
      persist(next);
    } else {
      const next = { ...prog, reveal, hints: prog.hints + 1 };
      setProg(next);
      persist(next);
    }
  }

  const worth = target ? wordValue(prog.reveal, target.length) : 0;

  return (
    <div className="flex flex-col gap-3">
      <ChainBoard words={round.words} solved={prog.solved} reveal={prog.reveal} />
      {prog.done ? (
        <p className="text-center text-win font-bold text-lg pop-in">
          🏁 Chain complete — {prog.score} pts banked!
        </p>
      ) : left === 0 ? (
        <p className="text-center text-fog">⏰ Time! You solved {prog.solved}/{HIDDEN_WORDS}.</p>
      ) : (
        // Sticky: the guess box rides the bottom of the screen while the
        // chain scrolls, so a phone never has to scroll down to type.
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-2 rounded-t-xl bg-ink/95 px-1 pt-2 pb-2 backdrop-blur">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={locked ? "Wrong — hang on…" : "Next word…"}
              disabled={locked}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              className={`flex-1 rounded-xl border-2 bg-card px-3 py-3 font-mono uppercase tracking-widest ${
                locked ? "border-lose" : "border-glow"
              }`}
            />
            <button
              onClick={submit}
              disabled={locked || !guess.trim()}
              className="rounded-xl bg-glow text-[#1a1000] px-5 font-bold disabled:opacity-40"
            >
              Go
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-fog">
              {locked
                ? `Locked ${Math.ceil((lockUntil - Date.now()) / 1000)}s`
                : `Worth ${worth} pts · you have ${prog.score}`}
            </span>
            <button
              onClick={hint}
              disabled={locked}
              className="rounded-lg border border-line px-3 py-1.5 font-semibold text-fog hover:border-violet disabled:opacity-40"
            >
              💡 Buy a letter (−2)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
