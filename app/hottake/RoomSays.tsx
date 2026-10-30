"use client";

import { Drumroll, Stamp } from "@/app/components/fx";
import { REVEAL } from "./reveal";

// The room's pick: a drumroll, then the 🏅 card slams in. The host screen and
// the phones render the same card on the same beat. Display only.
export function RoomSays({
  names,
  tie,
  prompt,
  compact = false,
}: {
  names: string;
  tie: boolean;
  prompt: string;
  compact?: boolean;
}) {
  // Prompts are written as questions ("cry at a commercial?"); this line reads as a statement.
  const line = prompt.replace(/\?+\s*$/, "");
  return (
    <Drumroll ms={REVEAL.drum} tease="🥁 The room says…">
      <div className={`neon-panel flex flex-col items-center gap-2 text-center ${compact ? "p-4" : "p-5"}`}>
        <div aria-hidden className={compact ? "text-3xl" : "text-4xl"}>
          🏅
        </div>
        {/* The accent's light orange without neon-text's glow: the panel already
            glows, and a screen gets three glows at most. */}
        <div
          className={`font-display max-w-full break-words ${compact ? "text-2xl" : "text-3xl"}`}
          style={{ color: "#ffd29a" }}
        >
          {names}
        </div>
        {tie && <Stamp tone="gold">Tie</Stamp>}
        <div className={`text-fog ${compact ? "text-xs" : "text-sm"}`}>Most likely to {line}</div>
      </div>
    </Drumroll>
  );
}
