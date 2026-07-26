"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { supabase, Game, Card, Cell } from "@/lib/needle/types";
import { checkWin } from "@/lib/needle/bingo";

export default function PlayCard({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [game, setGame] = useState<Game | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [marked, setMarked] = useState<Set<number>>(new Set([12]));
  const [strikes, setStrikes] = useState(0);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const prevCalledRef = useRef<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cardId =
        typeof window !== "undefined"
          ? localStorage.getItem(`needle-card-${code}`)
          : null;
      if (!cardId) {
        setErr("No card on this device. Go back and join.");
        return;
      }
      const { data: g } = await supabase
        .from("games")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (cancelled) return;
      if (!g) {
        setErr("Game not found.");
        return;
      }
      const { data: c } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .maybeSingle();
      if (cancelled) return;
      setGame(g as Game);
      setCard(c as Card);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Realtime subscription
  useEffect(() => {
    if (!game) return;
    const ch = supabase
      .channel(`player-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `code=eq.${code}`,
        },
        (payload) => setGame((g) => (g ? ({ ...g, ...payload.new } as Game) : g)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [game?.id, code]);

  // Beginner mode: auto-mark called squares
  useEffect(() => {
    if (!game || !card || game.difficulty !== "beginner") return;
    const calledSet = new Set(game.called);
    setMarked((curr) => {
      const next = new Set(curr);
      card.grid.forEach((cell, i) => {
        if (!("free" in cell) && calledSet.has(cell.youtube_id)) {
          next.add(i);
        }
      });
      return next;
    });
    prevCalledRef.current = game.called;
  }, [game?.called, game?.difficulty, card]);

  if (err)
    return (
      <main className="dark p-6 flex flex-col gap-4">
        <p className="text-red-600">{err}</p>
        <Link href="/needle/play" className="underline">
          Back to join
        </Link>
      </main>
    );
  if (!game || !card)
    return (
      <main className="dark p-6">
        <p>Loading…</p>
      </main>
    );

  if (game.status === "ended")
    return (
      <main className="dark flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-3xl font-bold">Game over</h1>
        <p className="text-zinc-500">The host ended the game.</p>
        <Link href="/" className="underline">
          Home
        </Link>
      </main>
    );

  const isLocked = game.difficulty === "novice" && strikes >= 3;
  const calledSet = new Set(game.called);

  function toggle(i: number) {
    if (!card) return;
    if (i === 12) return; // free space always marked
    if (isLocked) return;
    if (game?.difficulty === "beginner") {
      // Auto-mark handles it; let the player toggle too just in case.
    }
    const cell = card.grid[i];
    const wasMarked = marked.has(i);

    // Only count strikes on NEW marks (turning a square on), not unmarks.
    if (
      !wasMarked &&
      game?.difficulty === "novice" &&
      !("free" in cell) &&
      !calledSet.has(cell.youtube_id)
    ) {
      setStrikes((s) => s + 1);
      setShakeIdx(i);
      setTimeout(() => setShakeIdx((x) => (x === i ? null : x)), 600);
    }

    setMarked((curr) => {
      const next = new Set(curr);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const markedCallSet: string[] = [];
  card.grid.forEach((cell: Cell, i: number) => {
    if (marked.has(i) && !("free" in cell)) {
      markedCallSet.push(cell.youtube_id);
    }
  });
  const localWin = checkWin(card.grid, markedCallSet, game.pattern);

  const diffLabel =
    game.difficulty === "expert"
      ? "Expert"
      : game.difficulty === "novice"
        ? `Novice · ${3 - strikes} ${3 - strikes === 1 ? "life" : "lives"}`
        : "Beginner";

  return (
    <main className="dark flex flex-1 flex-col gap-3 p-3 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-zinc-500 uppercase">
            {card.label} · {card.player_name}
          </div>
          <div className="text-sm font-semibold">
            Code {game.code} ·{" "}
            <span
              className={
                game.difficulty === "novice" && strikes > 0
                  ? "text-red-600"
                  : ""
              }
            >
              {diffLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 uppercase">Songs played</div>
          <div className="text-sm font-semibold">{game.called.length}</div>
        </div>
      </div>

      {isLocked && (
        <div className="rounded-lg bg-red-600 text-white p-3 text-center font-bold">
          OUT — 3 strikes. Card locked.
        </div>
      )}

      <div className={`grid grid-cols-5 gap-1 ${isLocked ? "opacity-40" : ""}`}>
        {card.grid.map((cell, i) => {
          const isFree = "free" in cell;
          const isMarked = marked.has(i) || isFree;
          const shaking = shakeIdx === i;
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              disabled={isLocked}
              className={`aspect-square rounded text-[10px] sm:text-xs leading-tight p-1 flex items-center justify-center text-center font-medium border-2 transition
                ${
                  isMarked
                    ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                    : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                }
                ${shaking ? "!bg-red-600 !text-white !border-red-700 animate-pulse" : ""}
              `}
            >
              {isFree ? "FREE" : cell.name}
            </button>
          );
        })}
      </div>

      {localWin && !isLocked && (
        <div className="rounded-lg bg-yellow-300 text-black p-3 text-center font-bold">
          Looks like BINGO! Show {card.label} to the host to verify.
        </div>
      )}

      <p className="text-xs text-zinc-500 text-center">
        {game.difficulty === "expert" &&
          "Listen, tap a square if you hear that song."}
        {game.difficulty === "novice" &&
          "Tap squares for songs you hear. Wrong tap = strike. 3 strikes and you're out."}
        {game.difficulty === "beginner" &&
          "Squares auto-mark when songs are called. Just shout BINGO when you get a line."}
      </p>
    </main>
  );
}
