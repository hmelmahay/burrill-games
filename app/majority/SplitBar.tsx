"use client";

import { useLayoutEffect, useRef } from "react";
import { clamp } from "@/lib/fx";
import { playKeyframes, useRevealTiming } from "@/lib/motion";
import { REVEAL } from "./reveal";

// Tug of war for the A/B split: the orange fill is A, the violet track is B.
// The fill rests at the final split. On a screen that saw the reveal happen it
// starts at 50/50, overshoots a little and settles by the verdict beat. Inline
// styles only (no Tailwind transform utilities), so a TV copy renders it too.
export function SplitBar({ aCount, bCount, size = "md" }: { aCount: number; bCount: number; size?: "sm" | "md" }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const { delay, staged } = useRevealTiming();
  const total = aCount + bCount;
  const frac = total > 0 ? aCount / total : 0.5;

  // Layout effect: the tug starts before the first paint, so the final split
  // never flashes first. Skipped for a one-sided or empty vote.
  useLayoutEffect(() => {
    if (!staged || total === 0 || frac <= 0 || frac >= 1) return;
    const over = clamp(frac + (frac - 0.5) * 0.15, 0, 1);
    playKeyframes(
      fillRef.current,
      [{ transform: "scaleX(0.5)" }, { transform: `scaleX(${over})`, offset: 0.7 }, { transform: `scaleX(${frac})` }],
      { duration: REVEAL.verdict, delay, easing: "ease-out", fill: "backwards" },
    );
  }, [staged, total, frac, delay]);

  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-full ${size === "sm" ? "h-4" : "h-6"}`}
      style={{ background: "#7c5cff" }}
    >
      <div
        ref={fillRef}
        className="absolute top-0 bottom-0 left-0"
        style={{ width: "100%", transformOrigin: "0 50%", transform: `scaleX(${frac})`, background: "#ff9f1c" }}
      />
    </div>
  );
}
