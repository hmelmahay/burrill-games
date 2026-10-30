"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { mulberry32 } from "@/lib/fx";
import { prefersReducedMotion, useRevealTiming } from "@/lib/motion";

const COLORS = ["#ff9f1c", "#7c5cff", "#ffd166", "#ff4fd8", "#2de2e6", "#f2f3ff"];

// Fires once on mount, after the surrounding <Reveal> delay plus `delayMs`.
// Renders into <body> (a moving parent can't trap it), ignores taps, removes
// itself, caps at 24 pieces on a TV copy or the quiz stage, and renders
// nothing under reduced motion or on a screen that missed the moment.
export function Confetti({ pieces = 36, delayMs = 0, fire = true }: { pieces?: number; delayMs?: number; fire?: boolean }) {
  const { delay, staged } = useRevealTiming();
  const [node, setNode] = useState<ReactNode>(null);
  useEffect(() => {
    if (!fire || !staged || prefersReducedMotion()) return;
    const calm = document.querySelector(".tv-mode, .calm") !== null;
    const n = Math.min(pieces, calm ? 24 : 60);
    const rand = mulberry32((Date.now() & 0xffff) ^ (n << 8));
    const start = delay + delayMs;
    const items = Array.from({ length: n }, (_, i) => {
      const dur = 1600 + rand() * 1000;
      return (
        <span
          key={i}
          className={`fx-confetto fx-c${1 + (i % 4)}`}
          style={{
            left: `${rand() * 100}%`,
            width: 6 + Math.round(rand() * 5),
            height: 9 + Math.round(rand() * 6),
            background: COLORS[i % COLORS.length],
            animationDuration: `${Math.round(dur)}ms`,
            animationDelay: `${Math.round(start + rand() * 300)}ms`,
          }}
        />
      );
    });
    setNode(
      createPortal(
        <div className="fx-confetti" aria-hidden>
          {items}
        </div>,
        document.body,
      ),
    );
    const t = setTimeout(() => setNode(null), start + 3000);
    return () => {
      clearTimeout(t);
      setNode(null);
    };
  }, [fire, staged, pieces, delayMs, delay]);
  return <>{node}</>;
}
