"use client";

// The topic card: a 4×4 grid of words. `highlightIdx` marks the secret word
// (omit it for the chameleon and for shared screens). With `onPick` the grid
// becomes the caught chameleon's guess keypad; `pickedIdx` shows a locked or
// revealed pick.
export function WordGrid({
  words,
  highlightIdx,
  onPick,
  pickedIdx,
}: {
  words: string[];
  highlightIdx?: number | null;
  onPick?: (idx: number) => void;
  pickedIdx?: number | null;
}) {
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
        return onPick ? (
          <button
            key={i}
            onClick={() => onPick(i)}
            className={`rounded-lg border-2 px-1 py-2.5 text-center text-xs sm:text-sm font-semibold leading-tight break-words hover:border-glow ${cls}`}
          >
            {w}
          </button>
        ) : (
          <div
            key={i}
            className={`rounded-lg border-2 px-1 py-2.5 text-center text-xs sm:text-sm font-semibold leading-tight break-words ${cls}`}
          >
            {w}
          </div>
        );
      })}
    </div>
  );
}
