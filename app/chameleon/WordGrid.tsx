"use client";

import { useRevealTiming } from "@/lib/motion";

const TILE = "rounded-lg border-2 px-1 py-2.5 text-center text-xs sm:text-sm font-semibold leading-tight break-words";

// The topic card: a 4×4 grid of words. `highlightIdx` marks the secret word
// (omit it for the chameleon and for shared screens). With `onPick` the grid
// becomes the caught chameleon's guess keypad; `pickedIdx` shows a locked or
// revealed pick, with an orange ✕.
//
// `flipDelayMs` (the reveal): the secret and the pick start as plain tiles,
// and their marked face flips in at that time (plus any parent Reveal's
// delay), so the grid gives nothing away while the outcome is still coming.
// A screen that missed the moment shows the marked tiles at once.
export function WordGrid({
  words,
  highlightIdx,
  onPick,
  pickedIdx,
  flipDelayMs,
}: {
  words: string[];
  highlightIdx?: number | null;
  onPick?: (idx: number) => void;
  pickedIdx?: number | null;
  flipDelayMs?: number;
}) {
  const { delay, staged } = useRevealTiming();
  const cue = flipDelayMs != null && staged ? delay + flipDelayMs : null;
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {words.map((w, i) => {
        const isSecret = highlightIdx === i;
        const isPicked = pickedIdx === i;
        const cls = isSecret
          ? "border-win bg-win/20 text-win font-extrabold"
          : isPicked
            ? "border-glow bg-glow/20 text-glow font-extrabold"
            : "border-line bg-card";
        if (onPick)
          return (
            <button
              key={i}
              onClick={() => onPick(i)}
              className={`press ${TILE} hover:border-glow ${cls}`}
            >
              {w}
            </button>
          );
        if (flipDelayMs != null && (isSecret || isPicked))
          return (
            <div key={i} className={`relative ${TILE} border-line bg-card`}>
              {w}
              {/* The marked face covers the plain tile, border included. Opaque
                  literal colors so the word underneath can't show through. */}
              <span
                aria-hidden
                className={`pointer-events-none absolute ${cue != null ? "fx-fade" : ""}`}
                style={{ top: -2, right: -2, bottom: -2, left: -2, ...(cue != null ? { animationDelay: `${cue}ms` } : {}) }}
              >
                <span
                  className={`flex h-full w-full items-center justify-center rounded-lg border-2 px-1 font-extrabold ${
                    isSecret ? "border-win text-win" : "border-glow text-glow"
                  } ${cue != null ? "fx-flip-y" : ""}`}
                  style={{
                    background: isSecret ? "#143635" : "#3d2d24",
                    ...(cue != null ? { animationDelay: `${cue}ms` } : {}),
                  }}
                >
                  {w}
                </span>
                {isPicked && !isSecret && <PickMark at={cue != null ? cue + 200 : null} />}
              </span>
            </div>
          );
        return (
          <div key={i} className={`${isPicked && !isSecret ? "relative" : ""} ${TILE} ${cls}`}>
            {w}
            {isPicked && !isSecret && <PickMark at={null} />}
          </div>
        );
      })}
    </div>
  );
}

// The orange ✕ on a wrong pick. `at` pops it in at that time; null shows it at once.
function PickMark({ at }: { at: number | null }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-xs font-extrabold ${
        at != null ? "fx-pop" : ""
      }`}
      style={{ background: "#ff9f1c", color: "#1a1000", ...(at != null ? { animationDelay: `${at}ms` } : {}) }}
    >
      ✕
    </span>
  );
}
