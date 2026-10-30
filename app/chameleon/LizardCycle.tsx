"use client";

import { useRevealTiming } from "@/lib/motion";

// The 🦎 on the outcome card. After an escape it changes color a few times:
// two hue-shifted copies flash over it, starting when the card lands. The
// filters are static, so only opacity animates. `attract` lets a TV copy stop
// the loop, and a screen that missed the moment shows the plain lizard.
export function LizardCycle({ cycle }: { cycle: boolean }) {
  const { delay, staged } = useRevealTiming();
  if (!cycle || !staged) return <span>🦎</span>;
  return (
    <span className="fx-cycle">
      🦎
      <span
        aria-hidden
        className="fx-cycle-copy attract"
        style={{ filter: "hue-rotate(120deg)", animationDelay: `${delay}ms` }}
      >
        🦎
      </span>
      <span
        aria-hidden
        className="fx-cycle-copy attract"
        style={{ filter: "hue-rotate(240deg)", animationDelay: `${delay + 400}ms` }}
      >
        🦎
      </span>
    </span>
  );
}
