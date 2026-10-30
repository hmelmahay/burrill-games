"use client";

import type { CSSProperties } from "react";
import { PlayerDot } from "@/app/components/brand";
import { Reveal, RingBurst, Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";
import { stagger } from "@/lib/fx";
import type { BallparkResult } from "@/app/ballpark/constants";
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

type Pin = { id: string; name: string; guess: number; distance: number; pct: number; side: -1 | 0 | 1 };
type Align = "start" | "center" | "end";

// Near an end of the line a label runs inward, so it never leaves the card.
function alignOf(pct: number): Align {
  return pct < 15 ? "start" : pct > 85 ? "end" : "center";
}

// Walking left to right, each label takes the first of three rows where it
// clears the label before it, else the row that frees up soonest. Spans are
// estimated in px for EST_LINE_PX (text-xs bold is about 7.5px a character).
function labelRows(pinsLeftToRight: Pin[]): Map<string, number> {
  const end = [-Infinity, -Infinity, -Infinity];
  const rows = new Map<string, number>();
  for (const p of pinsLeftToRight) {
    const w = Math.min(LABEL_MAX_PX, 7.5 * Array.from(p.name).length + 2);
    const x = (p.pct / 100) * EST_LINE_PX;
    const align = alignOf(p.pct);
    const [a, b] = align === "start" ? [x - 12, x - 12 + w] : align === "end" ? [x + 12 - w, x + 12] : [x - w / 2, x + w / 2];
    let r = end.findIndex((e) => e + 6 <= a);
    if (r < 0) r = end.indexOf(Math.min(...end));
    end[r] = b;
    rows.set(p.id, r);
  }
  return rows;
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
  const rowOf = labelRows([...pins].sort((a, b) => a.pct - b.pct || a.guess - b.guess));
  const firstOff = (side: -1 | 1) => {
    const at = pins.filter((p) => p.side === side).map((p) => dropAt.get(p.id) ?? 0);
    return at.length > 0 ? Math.min(...at) : null;
  };
  const leftOffAt = firstOff(-1);
  const rightOffAt = firstOff(1);
  const flagText = `${answer.toLocaleString()}${unit ? ` ${unit}` : ""}`;
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
          const row = rowOf.get(p.id) ?? 0;
          const a = alignOf(p.pct);
          const align: CSSProperties =
            a === "start"
              ? { left: "-0.75rem", textAlign: "left" }
              : a === "end"
                ? { right: "-0.75rem", textAlign: "right" }
                : { left: "-3rem", textAlign: "center" };
          return (
            <div key={p.id} className="absolute top-0 bottom-0" style={{ left: `${p.pct}%`, width: 0 }}>
              <Reveal kind="drop" delayMs={dropAt.get(p.id) ?? 0} className="absolute top-0 bottom-0 left-0" style={{ width: 0 }}>
                <span
                  className="absolute flex items-center justify-center rounded-full"
                  style={{ ...pinBox, background: "#0d1026" }}
                >
                  <PlayerDot id={p.id} name={p.name} size="sm" />
                </span>
                <span
                  className="absolute truncate text-xs font-bold"
                  style={{ top: `${LABEL_TOP + row * ROW}rem`, width: "6rem", lineHeight: `${ROW}rem`, ...align }}
                >
                  {p.name}
                </span>
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
