"use client";

import { useState } from "react";
import { Reveal } from "@/app/components/fx";
import { useAfter } from "@/lib/motion";
import { maskWord } from "./constants";
import { REVEAL } from "./reveal";

// The chain as a column of rows: solved words in full, the current target
// masked to its revealed letters, everything below as blank slots. Renders
// only information the viewer is allowed to see, so it's safe on the shared
// host screen and the TV as well as on phones.
//
// Motion:  a word solved while the board is on screen flips in, and the
// current word pops each time another letter shows.  `cascade` (reveal
// screens) deals every row in from the top, 60ms apart.
export function ChainBoard({
  words,
  solved,
  reveal,
  showAll = false,
  cascade = false,
}: {
  words: string[];
  solved: number; // words solved beyond the first
  reveal: number; // letters showing on the current target
  showAll?: boolean; // reveal screens: the whole chain, no masking
  cascade?: boolean; // reveal screens: rows rise in one after another
}) {
  // Rows up to `base` were already solved when this screen first showed
  // them, so they don't flip.  Only a one-word step after the board settles
  // counts as a live solve.  Any other change moves `base` along with it:
  // RacePanel restoring saved progress right after a refresh, or a missed
  // update the poll catches up on.  So a refreshed phone never replays the chain.
  const settled = useAfter(400);
  const [seen, setSeen] = useState({ solved, base: solved });
  let base = seen.base;
  if (solved !== seen.solved) {
    base = settled && solved === seen.solved + 1 ? seen.base : solved;
    setSeen({ solved, base });
  }

  return (
    <ol className="flex flex-col gap-1.5 font-mono">
      {words.map((w, i) => {
        const isGiven = i === 0;
        const isSolved = i <= solved;
        const isCurrent = !showAll && i === solved + 1;
        const text = showAll || isSolved ? w.split("").join(" ") : maskWord(w, isCurrent ? reveal : 0);
        const flip = !showAll && !cascade && isSolved && i > base;
        const rowClass = `rounded-lg border px-3 py-2 text-center font-bold tracking-widest ${
          isCurrent
            ? "border-violet bg-violet/15 text-lg"
            : showAll || isSolved
              ? "border-line bg-card text-glow"
              : "border-line bg-card text-fog/50"
        }`;
        const body = (
          <>
            {isCurrent ? (
              // Keyed on the letters showing, so a bought (or missed) letter pops.
              <span key={reveal} className="inline-block pop-in">
                {text}
              </span>
            ) : (
              text
            )}
            {isGiven && !showAll && (
              <span className="ml-2 text-[10px] font-normal tracking-normal text-fog align-middle">
                start
              </span>
            )}
          </>
        );
        if (cascade)
          return (
            <Reveal as="li" key={i} kind="rise" delayMs={i * REVEAL.rowStep} className={rowClass}>
              {body}
            </Reveal>
          );
        // A row remounts when it becomes solved (new key), so its flip plays once.
        return (
          <li key={isSolved ? `${i}-solved` : i} className={`${rowClass} ${flip ? "fx-flip" : ""}`}>
            {body}
          </li>
        );
      })}
    </ol>
  );
}
