"use client";

import { maskWord } from "./constants";

// The chain as a column of rows: solved words in full, the current target
// masked to its revealed letters, everything below as blank slots. Renders
// only information the viewer is allowed to see, so it's safe on the shared
// host screen and the TV as well as on phones.
export function ChainBoard({
  words,
  solved,
  reveal,
  showAll = false,
}: {
  words: string[];
  solved: number; // words solved beyond the first
  reveal: number; // letters showing on the current target
  showAll?: boolean; // reveal screens: the whole chain, no masking
}) {
  return (
    <ol className="flex flex-col gap-1.5 font-mono">
      {words.map((w, i) => {
        const isGiven = i === 0;
        const isSolved = i <= solved;
        const isCurrent = !showAll && i === solved + 1;
        const text = showAll || isSolved ? w.split("").join(" ") : maskWord(w, isCurrent ? reveal : 0);
        return (
          <li
            key={i}
            className={`rounded-lg border px-3 py-2 text-center font-bold tracking-widest ${
              isCurrent
                ? "border-violet bg-violet/15 text-lg"
                : showAll || isSolved
                  ? "border-line bg-card text-glow"
                  : "border-line bg-card text-fog/50"
            }`}
          >
            {text}
            {isGiven && !showAll && (
              <span className="ml-2 text-[10px] font-normal tracking-normal text-fog align-middle">
                start
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
