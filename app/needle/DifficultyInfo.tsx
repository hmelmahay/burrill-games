"use client";

import { useState } from "react";

// Little ℹ️ toggle that explains what each difficulty does.
export function DifficultyInfo() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What do the difficulty levels mean?"
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full border border-zinc-400 dark:border-zinc-600 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 leading-none hover:bg-zinc-200 dark:hover:bg-zinc-800"
      >
        i
      </button>
      {open && (
        <div
          className="absolute z-20 top-7 left-1/2 -translate-x-1/2 w-72 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-left text-xs shadow-xl flex flex-col gap-2"
          onClick={() => setOpen(false)}
        >
          <p>
            <span className="font-bold">Expert — no help.</span> Tap whatever you think
            you heard; the app gives no feedback. Wrong marks only surface when the host
            verifies your bingo.
          </p>
          <p>
            <span className="font-bold">Novice — 3 strikes.</span> Tapping a song that
            hasn&apos;t been played flashes red and costs a strike. Three strikes locks
            your card.
          </p>
          <p>
            <span className="font-bold">Beginner — auto-mark.</span> Squares mark
            themselves when their song is called. Just shout bingo.
          </p>
          <p className="text-zinc-500">Applies to every player in the game.</p>
        </div>
      )}
    </span>
  );
}
