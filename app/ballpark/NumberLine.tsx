"use client";

import type { CSSProperties } from "react";
import { PlayerDot } from "@/app/components/brand";
import { Reveal, RingBurst, Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";
import { stagger } from "@/lib/fx";
import type { BallparkResult } from "@/app/ballpark/constants";
import { formatterFor } from "@/app/ballpark/format";
import { PIN_MAX, PIN_STEP, REVEAL } from "@/app/ballpark/reveal";

// Layout in rem so it grows with the page's text size, TV zoom included.
const LINE = 2.75; // center of the axis line, from the top of the strip
const HALO = 1.5; // a pin: the player's dot on a dark disc
const ROW = 1; // height of one label row
const LABEL_TOP = LINE + HALO / 2 + 0.25;
const HEIGHT = LABEL_TOP + ROW * 3;
// Label rows are packed for a phone-width line, the tightest case; wider
// screens just get more room between names.
const EST_LINE_PX = 300;
const LABEL_MAX_PX = 96; // 6rem, the label box
const LABEL_GAP_PX = 6; // the least room between two labels on one row

type Pin = { id: string; name: string; guess: number; distance: number; pct: number; side: -1 | 0 | 1 };
type Align = "start" | "center" | "end";
// A pin's label:  its row, and how many other names were folded into it ("+2").
type Label = { row: number; more: number };

// Near an end of the line a label runs inward, so it never leaves the card.
function alignOf(pct: number): Align {
  return pct < 15 ? "start" : pct > 85 ? "end" : "center";
}

// A label's estimated width in px (text-xs bold is about 7.5px a character),
// counting its "+N" tail when other names are folded into it.
function labelPx(name: string, more: number): number {
  const tail = more > 0 ? ` +${more}`.length : 0;
  return Math.min(LABEL_MAX_PX, 7.5 * (Array.from(name).length + tail) + 2);
}

// Where a label sits on an EST_LINE_PX line:  [left, right] in px.
function labelSpan(pct: number, w: number): [number, number] {
  const x = (pct / 100) * EST_LINE_PX;
  const align = alignOf(pct);
  return align === "start" ? [x - 12, x - 12 + w] : align === "end" ? [x + 12 - w, x + 12] : [x - w / 2, x + w / 2];
}

// Walking left to right, each label takes the first of three rows where it
// clears the label before it.  When no row is free (four or more guesses
// bunched together), the name folds into a label right under its pin as "+1"
// instead of printing on top of another name, so a cluster reads "Steve +2".
// If no label under the pin can grow without touching its neighbor, the name
// is left off.  The sorted list under the line names everyone either way.
// Spans are estimated for EST_LINE_PX, the tightest case.
function labelLayout(pinsLeftToRight: Pin[]): Map<string, Label> {
  // The last label on each row, its span, and where the label before it ends.
  type Slot = { id: string; name: string; pct: number; more: number; start: number; end: number; before: number; seq: number };
  const last: (Slot | null)[] = [null, null, null];
  const out = new Map<string, Label>();
  const pinR = (HALO / 2) * 16; // a pin's radius in px
  pinsLeftToRight.forEach((p, seq) => {
    const [a, b] = labelSpan(p.pct, labelPx(p.name, 0));
    const r = last.findIndex((s) => s == null || s.end + LABEL_GAP_PX <= a);
    if (r >= 0) {
      last[r] = { id: p.id, name: p.name, pct: p.pct, more: 0, start: a, end: b, before: last[r]?.end ?? -Infinity, seq };
      out.set(p.id, { row: r, more: 0 });
      return;
    }
    // Every row is taken here.  Only a label that this pin sits over can take
    // the name, the nearest one first (the latest on a tie).
    const x = (p.pct / 100) * EST_LINE_PX;
    const under = last
      .flatMap((s, row) => (s && s.start - pinR <= x && x <= s.end + pinR ? [{ s, row }] : []))
      .sort((m, n) => Math.abs(m.s.pct - p.pct) - Math.abs(n.s.pct - p.pct) || n.s.seq - m.s.seq);
    for (const { s, row } of under) {
      const [a2, b2] = labelSpan(s.pct, labelPx(s.name, s.more + 1));
      if (a2 < s.before + LABEL_GAP_PX) continue;
      s.more += 1;
      s.start = a2;
      s.end = b2;
      out.set(s.id, { row, more: s.more });
      return;
    }
  });
  return out;
}

// The reveal's number line. It is linear and centered on the answer (guesses
// can be 0 or negative, so no log scale). Pins drop farthest first, the gold
// answer flag slams down at REVEAL.flag and the closest pins ring. Display
// only: it reads the results the host already scored. Everything is placed
// with left:% and negative offsets, never a transform, because the drop and
// slam animations own `transform` (and TV copies render this page too).
export function NumberLine({
  answer,
  unit,
  results,
}: {
  answer: number;
  unit: string;
  results: BallparkResult[];
}) {
  const guessed = results.flatMap((r) =>
    r.guess != null && Number.isFinite(r.guess) ? [{ id: r.player_id, name: r.name, guess: r.guess }] : [],
  );
  const dists = guessed.map((g) => Math.abs(g.guess - answer)).sort((a, b) => a - b);
  // 75th percentile (nearest rank): the farthest quarter of a big table can
  // run off the ends instead of squashing everyone else into the middle.
  const p75 = dists.length > 0 ? dists[Math.ceil(dists.length * 0.75) - 1] : 0;
  const span = 1.25 * Math.max(Math.abs(answer) * 0.1, p75, 1);

  const pins: Pin[] = guessed.map((g) => {
    const raw = 50 + ((g.guess - answer) / span) * 50;
    return {
      ...g,
      distance: Math.abs(g.guess - answer),
      pct: Math.min(100, Math.max(0, raw)),
      side: raw < 0 ? -1 : raw > 100 ? 1 : 0,
    };
  });
  const n = pins.length;
  const best = n > 0 ? Math.min(...pins.map((p) => p.distance)) : null;
  const exact = best === 0;

  // Farthest first, so the closest guess lands last (and paints on top).
  const dropOrder = [...pins].sort((a, b) => b.distance - a.distance);
  const dropAt = new Map(dropOrder.map((p, i) => [p.id, stagger(i, n, PIN_STEP, PIN_MAX)]));
  // Three label rows, filled in position order.
  const labelOf = labelLayout([...pins].sort((a, b) => a.pct - b.pct || a.guess - b.guess));
  const firstOff = (side: -1 | 1) => {
    const at = pins.filter((p) => p.side === side).map((p) => dropAt.get(p.id) ?? 0);
    return at.length > 0 ? Math.min(...at) : null;
  };
  const leftOffAt = firstOff(-1);
  const rightOffAt = firstOff(1);
  const flagText = `${formatterFor({ answer, unit })(answer)}${unit ? ` ${unit}` : ""}`;
  const pinBox: CSSProperties = {
    top: `${LINE - HALO / 2}rem`,
    left: `${-HALO / 2}rem`,
    width: `${HALO}rem`,
    height: `${HALO}rem`,
  };

  return (
    <div className="rounded-2xl bg-card border border-line px-4 pt-3 pb-3">
      <div className="relative" style={{ height: `${HEIGHT}rem` }}>
        <div
          aria-hidden
          className="absolute left-0 right-0 rounded-full"
          style={{ top: `calc(${LINE}rem - 2px)`, height: 4, background: "#3a4178" }}
        />
        {leftOffAt != null && (
          <Reveal kind="fade" delayMs={leftOffAt} className="absolute top-0 left-0 text-xs font-semibold text-fog">
            ◀ way off
          </Reveal>
        )}
        {rightOffAt != null && (
          <Reveal kind="fade" delayMs={rightOffAt} className="absolute top-0 right-0 text-xs font-semibold text-fog">
            way off ▶
          </Reveal>
        )}

        {/* The answer is always the middle of the line. Drawn before the pins
            so a dead-on pin sits on top of the pole. */}
        <Reveal
          kind="slam"
          delayMs={REVEAL.flag}
          className="absolute top-0 flex items-start justify-center"
          style={{ left: "50%", width: "12rem", marginLeft: "-6rem", height: `calc(${LINE}rem + 0.6rem)` }}
        >
          <span
            className="relative whitespace-nowrap rounded-md font-mono text-sm font-extrabold tabular-nums"
            style={{ zIndex: 1, padding: "0 0.5rem", lineHeight: "1.35rem", border: "2px solid #ffd166", color: "#ffd166", background: "#0d1026" }}
          >
            {flagText}
          </span>
          <span
            aria-hidden
            className="absolute"
            style={{ left: "50%", marginLeft: -1.5, top: "1.3rem", bottom: 0, width: 3, borderRadius: 2, background: "#ffd166" }}
          />
        </Reveal>

        {dropOrder.map((p) => {
          const label = labelOf.get(p.id);
          const a = alignOf(p.pct);
          const align: CSSProperties =
            a === "start"
              ? { left: "-0.75rem", justifyContent: "flex-start" }
              : a === "end"
                ? { right: "-0.75rem", justifyContent: "flex-end" }
                : { left: "-3rem", justifyContent: "center" };
          return (
            <div key={p.id} className="absolute top-0 bottom-0" style={{ left: `${p.pct}%`, width: 0 }}>
              <Reveal kind="drop" delayMs={dropAt.get(p.id) ?? 0} className="absolute top-0 bottom-0 left-0" style={{ width: 0 }}>
                <span
                  className="absolute flex items-center justify-center rounded-full"
                  style={{ ...pinBox, background: "#0d1026" }}
                >
                  <PlayerDot id={p.id} name={p.name} size="sm" />
                </span>
                {label && (
                  // The name shortens with an ellipsis before a "+N" tail is cut.
                  <span
                    className="absolute flex text-xs font-bold"
                    style={{ top: `${LABEL_TOP + label.row * ROW}rem`, width: "6rem", lineHeight: `${ROW}rem`, ...align }}
                  >
                    <span className="min-w-0 truncate">{p.name}</span>
                    {label.more > 0 && <span className="shrink-0 pl-1 text-fog">+{label.more}</span>}
                  </span>
                )}
              </Reveal>
              {p.distance === best && (
                <span aria-hidden className="absolute" style={pinBox}>
                  <RingBurst delayMs={REVEAL.ring} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {n === 0 && <p className="text-fog text-sm text-center">No guesses this round.</p>}
      {exact && (
        <div className="flex justify-center pt-2">
          <Stamp tone="gold" size="lg" delayMs={REVEAL.deadOn}>
            Dead on
          </Stamp>
          <Confetti delayMs={REVEAL.deadOn} />
        </div>
      )}
    </div>
  );
}
