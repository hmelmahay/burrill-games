"use client";

import type { CSSProperties } from "react";
import { Reveal, RingBurst } from "@/app/components/fx";
import { stagger } from "@/lib/fx";
import { BAND_STEP, BANDS, BULLSEYE, EDGE_CLIP, MARK_MAX, MARK_STEP, REVEAL } from "@/app/vibe/reveal";

// Literal colors, no Tailwind gradient utilities: TV copies render this too.
const TRACK = "linear-gradient(90deg, rgba(124,92,255,.5), #171b3a 50%, rgba(255,159,28,.5))";
const BAND_COLOR: Record<(typeof BANDS)[number], string> = {
  35: "rgba(242,243,255,.07)",
  20: "rgba(242,243,255,.08)",
  10: "rgba(242,243,255,.1)",
  5: "rgba(255,209,102,.35)",
};
// Label rows are packed for a phone-width dial, the tightest case; wider
// screens just get more room between names.
const EST_DIAL_PX = 340;

type Align = "start" | "center" | "end";

// A label's estimated width in px (11px bold is about 7px a character).
function labelPx(label: string): number {
  return Math.max(12, 7 * Array.from(label).length);
}

// A label sits centered under its dot unless that would run it off the dial,
// and then it runs inward from the dot.  Near either end it always runs
// inward.  A long label turns inward further from the ends:  a 20-character
// name plus " (you)" is about 160px, so centered at 16 or 84 on a phone it
// would run off the screen.
function alignOf(pos: number, w: number): Align {
  const x = (pos / 100) * EST_DIAL_PX;
  if (pos < 15 || x - w / 2 < 0) return "start";
  if (pos > 85 || x + w / 2 > EST_DIAL_PX) return "end";
  return "center";
}

// Walking left to right, each dial takes the first of three rows where its
// label clears the one before it, else the row that frees up soonest.  Spans
// are estimated in px for EST_DIAL_PX.
function labelRows(marksLeftToRight: { i: number; pos: number; label: string }[]): Map<number, number> {
  const end = [-Infinity, -Infinity, -Infinity];
  const rows = new Map<number, number>();
  for (const m of marksLeftToRight) {
    const w = labelPx(m.label);
    const x = (m.pos / 100) * EST_DIAL_PX;
    const align = alignOf(m.pos, w);
    const [a, b] = align === "start" ? [x - 8, x - 8 + w] : align === "end" ? [x + 8 - w, x + 8] : [x - w / 2, x + w / 2];
    let r = end.findIndex((e) => e + 6 <= a);
    if (r < 0) r = end.indexOf(Math.min(...end));
    end[r] = b;
    rows.set(m.i, r);
  }
  return rows;
}

// Shared by the host scoreboard and every player's phone, so everyone sees
// where each dial landed relative to the psychic's secret spot. With no
// target and no marks it is just the scale (the clue and guess phases).
// Inside a RevealScope the target drops, the scoring bands spread out from it,
// the dials pop in farthest first and dials within BULLSEYE ring.
export function Dial({
  marks,
  target,
  left,
  right,
}: {
  marks: { id?: string; pos: number; label: string; color: string }[];
  target?: number;
  left: string;
  right: string;
}) {
  const n = marks.length;
  const items = marks.map((m, i) => ({ m, i, d: target == null ? 0 : Math.abs(m.pos - target) }));
  // Farthest first, so the closest dial lands last (and paints on top).
  const popOrder = [...items].sort((a, b) => b.d - a.d);
  const popAt = new Map(popOrder.map((x, k) => [x.i, REVEAL.marks + stagger(k, n, MARK_STEP, MARK_MAX)]));
  // Three label rows, filled in position order.
  const rowOf = labelRows(
    [...items].sort((a, b) => a.m.pos - b.m.pos).map((x) => ({ i: x.i, pos: x.m.pos, label: x.m.label })),
  );

  return (
    // EDGE_CLIP keeps a ring at either end from widening the page on a phone,
    // and its 1rem of margin and padding leaves the end dots room.
    <div className="flex flex-col gap-1" style={EDGE_CLIP}>
      <div className="relative h-24 rounded-xl border border-line" style={{ background: TRACK }}>
        {target != null && (
          <div aria-hidden className="absolute top-0 right-0 bottom-0 left-0 overflow-hidden" style={{ borderRadius: 11 }}>
            {BANDS.map((r, k) => {
              const lo = Math.max(0, target - r);
              const hi = Math.min(100, target + r);
              return (
                <Reveal
                  key={r}
                  kind="fade"
                  delayMs={REVEAL.target + (BANDS.length - 1 - k) * BAND_STEP}
                  className="absolute top-0 bottom-0"
                  style={{ left: `${lo}%`, width: `${hi - lo}%`, background: BAND_COLOR[r] }}
                />
              );
            })}
          </div>
        )}
        {target != null && (
          <Reveal
            kind="drop"
            delayMs={REVEAL.target}
            className="absolute top-0 bottom-0 rounded bg-win"
            style={{ left: `calc(${target}% - 3px)`, width: 6 }}
          />
        )}
        {popOrder.map(({ m, i, d }) => {
          const at = popAt.get(i) ?? REVEAL.marks;
          const close = target != null && d <= BULLSEYE;
          const a = alignOf(m.pos, labelPx(m.label));
          const label: CSSProperties =
            a === "start" ? { left: -2 } : a === "end" ? { right: -2 } : { left: "50%", transform: "translateX(-50%)" };
          return (
            <div
              key={m.id ?? i}
              className="absolute"
              style={{ left: `${m.pos}%`, top: `${8 + (rowOf.get(i) ?? 0) * 26}px`, transform: "translateX(-50%)" }}
            >
              {/* The outer wrapper owns the centering transform; this inner
                  child is what pops. */}
              <Reveal kind="pop" delayMs={at} className="relative">
                <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: m.color }} />
                {close && <RingBurst delayMs={Math.max(0, REVEAL.bullseye - at)} />}
                <span
                  className="absolute text-[11px] font-bold whitespace-nowrap"
                  style={{ top: 13, lineHeight: "13px", ...label }}
                >
                  {m.label}
                </span>
              </Reveal>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-sm font-bold">
        <span>← {left}</span>
        <span>{right} →</span>
      </div>
    </div>
  );
}
