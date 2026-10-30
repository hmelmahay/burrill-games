"use client";

import { useLayoutEffect, useRef } from "react";
import { clamp } from "@/lib/fx";
import { playKeyframes, useAfter, useRevealTiming } from "@/lib/motion";
import { REVEAL } from "./reveal";

// How far the tug sways off 50/50 before it commits.  Every split sways the
// same way by the same amount, so the first half of the beat gives nothing away.
const SWAY = 0.04;

// Tug of war for the A/B split: the orange fill is A, the violet track is B.
// On a screen that saw the reveal happen the fill holds 50/50 until the verdict
// beat, even when the tug doesn't run (reduced motion, an empty vote, no WAAPI),
// so it never shows the answer before the host's stamp. Where it
// runs, the tug sways a little each way around 50/50, commits late, overshoots
// and settles on that beat. A late or refreshed screen shows the final split at
// once. Inline styles only (no Tailwind transform utilities), so a TV copy
// renders it too.
export function SplitBar({ aCount, bCount, size = "md" }: { aCount: number; bCount: number; size?: "sm" | "md" }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const { delay, staged } = useRevealTiming();
  const settled = useAfter(delay + REVEAL.verdict, staged);
  const total = aCount + bCount;
  const frac = total > 0 ? aCount / total : 0.5;

  // Layout effect: the tug starts before the first paint. Its end frame stays
  // on (fill both) until `settled` flips the resting style, so the bar never
  // snaps back to 50/50 in between. One-sided and tied votes sway too, so a
  // bar sitting still can't tell the room early; only an empty vote holds.
  //
  // Linear overall, so each offset is that share of the beat (900ms): sway
  // toward A by 30%, toward B by 55%, then commit, slow at first, to a small
  // overshoot by 85%, and settle on the final split at 100%.
  useLayoutEffect(() => {
    if (!staged || total === 0) return;
    const el = fillRef.current;
    const over = clamp(frac + (frac - 0.5) * 0.15, 0, 1);
    playKeyframes(
      el,
      [
        { transform: "scaleX(0.5)", easing: "ease-in-out" },
        { transform: `scaleX(${0.5 + SWAY})`, offset: 0.3, easing: "ease-in-out" },
        { transform: `scaleX(${0.5 - SWAY})`, offset: 0.55, easing: "cubic-bezier(0.6, 0, 0.8, 1)" },
        { transform: `scaleX(${over})`, offset: 0.85, easing: "ease-in-out" },
        { transform: `scaleX(${frac})` },
      ],
      { duration: REVEAL.verdict, delay, easing: "linear", fill: "both" },
    );
    // A held end frame would outlive new counts, so drop it when they change.
    return () => el?.getAnimations?.().forEach((a) => a.cancel());
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
        style={{
          width: "100%",
          transformOrigin: "0 50%",
          transform: `scaleX(${!staged || settled ? frac : 0.5})`,
          background: "#ff9f1c",
        }}
      />
    </div>
  );
}
