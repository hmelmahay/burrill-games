"use client";

import { useEffect, useState } from "react";
import { Game, Card, Cell } from "@/lib/needle/types";
import { checkWin } from "@/lib/needle/bingo";
import { Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";

// Column header over the card, one arcade color per letter.
const BINGO_HEAD = [
  ["B", "text-glow"],
  ["I", "text-violet"],
  ["N", "text-gold"],
  ["G", "text-pink"],
  ["O", "text-cyan"],
] as const;

// One player's bingo card: marking, Novice strikes, Beginner auto-marks and
// the "looks like BINGO" nudge. Shared by the phone view and the host screen,
// so whoever runs the music can play a card on the same device.
export function BingoCard({ game, card }: { game: Game; card: Card }) {
  const [marked, setMarked] = useState<Set<number>>(new Set([12]));
  const [strikes, setStrikes] = useState(0);
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);

  // Beginner mode: auto-mark called squares
  useEffect(() => {
    if (game.difficulty !== "beginner") return;
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
  }, [game.called, game.difficulty, card]);

  const isLocked = game.difficulty === "novice" && strikes >= 3;
  const calledSet = new Set(game.called);

  function toggle(i: number) {
    if (i === 12) return; // free space always marked
    if (isLocked) return;
    const cell = card.grid[i];
    const wasMarked = marked.has(i);

    // Only count strikes on NEW marks (turning a square on), not unmarks.
    if (
      !wasMarked &&
      game.difficulty === "novice" &&
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

  // Novice lives as hearts; the label keeps the count for screen readers.
  const lives = Math.max(0, 3 - strikes);
  const diffLabel =
    game.difficulty === "expert" ? (
      "Expert"
    ) : game.difficulty === "novice" ? (
      <>
        Novice ·{" "}
        <span role="img" aria-label={`${lives} ${lives === 1 ? "life" : "lives"} left`}>
          {"❤️".repeat(lives)}
          {"🤍".repeat(3 - lives)}
        </span>
      </>
    ) : (
      "Beginner"
    );

  return (
    <div className="flex flex-col gap-3">
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
                  ? "text-lose"
                  : ""
              }
            >
              {diffLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 uppercase">Songs played</div>
          {/* Re-keyed per song, so every phone gets a small "new song" pop. */}
          <span
            key={game.called.length}
            className="fx-pop inline-block font-mono text-lg font-bold tabular-nums"
          >
            {game.called.length}
          </span>
        </div>
      </div>

      {isLocked && (
        <div className="rounded-lg bg-red-600 text-white p-3 text-center font-bold">
          OUT — 3 strikes. Card locked.
        </div>
      )}

      <div className={`flex flex-col gap-1 ${isLocked ? "opacity-40" : ""}`}>
        <div
          aria-hidden
          className="grid grid-cols-5 gap-1 text-center font-display text-2xl sm:text-3xl leading-none"
        >
          {BINGO_HEAD.map(([letter, color]) => (
            <span key={letter} className={color}>
              {letter}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {card.grid.map((cell, i) => {
            const isFree = "free" in cell;
            const isMarked = marked.has(i) || isFree;
            const shaking = shakeIdx === i;
            return (
              <button
                key={i}
                onClick={() => toggle(i)}
                disabled={isLocked}
                className={`press aspect-square rounded text-[10px] sm:text-xs leading-tight p-1 flex items-center justify-center text-center border-2 transition
                  ${
                    isFree
                      ? "bg-ink text-gold border-gold font-bold"
                      : isMarked
                        ? "bg-violet text-white border-violet font-medium"
                        : "bg-zinc-900 text-zinc-100 border-zinc-700 font-medium"
                  }
                  ${shaking ? "!bg-red-600 !text-white !border-red-700 fx-shake" : ""}
                `}
              >
                {/* Keyed on the mark, so the dauber lands each time a square gets marked. */}
                <span key={isMarked ? "on" : "off"} className={isMarked && !isFree ? "fx-dauber" : undefined}>
                  {isFree ? "⭐ FREE" : cell.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {localWin && !isLocked && (
        <div className="neon-panel acc-gold p-4 flex flex-col items-center gap-2 text-center">
          <Stamp tone="gold" size="lg">
            Bingo?
          </Stamp>
          <div className="font-bold">
            Looks like BINGO! Show {card.label} to the host to verify.
          </div>
          <Confetti pieces={24} />
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
    </div>
  );
}
