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
                  <FaceWord word={w} />
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

// The word on a marked face.  The face is a flex box, and a flex item won't
// shrink below its longest word, so a long single word (Ghostbusters on a 375
// phone) ran over the border.  A single word now sits in a min-w-0 span that
// wraps with break-words.  It may use the face's 4px padding first, since the
// bolder face is wider than the plain tile and most 10-letter words still fit
// on one line that way.  A word that has to wrap breaks near its middle
// ("Ghost / busters") rather than leaving one letter on the second line.
// Entries with spaces or hyphens wrap at those, as before.
function FaceWord({ word }: { word: string }) {
  if (/[\s-]/.test(word)) return word;
  const at = /^[A-Za-z]{8,}$/.test(word) ? breakPoint(word) : 0;
  return (
    <span className="-mx-1 min-w-0 break-words">
      {at ? (
        <>
          {word.slice(0, at)}
          <wbr />
          {word.slice(at)}
        </>
      ) : (
        word
      )}
    </span>
  );
}

// The middle of the word, moved one letter when that puts the break between
// two consonants (Ghost / busters, not Ghostb / usters).
function breakPoint(word: string): number {
  const mid = Math.floor(word.length / 2);
  const consonant = (c: string) => !/[aeiou]/i.test(c);
  return [mid, mid - 1, mid + 1].find((i) => consonant(word[i - 1]) && consonant(word[i])) ?? mid;
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
