"use client";

import { createElement, useEffect, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { Player } from "@/lib/supabase";
import { FX, TONE_HEX, mulberry32, stagger, type Tone } from "@/lib/fx";
import { RevealContext, prefersReducedMotion, shownScores, useRevealTiming } from "@/lib/motion";
import { Marquee, PlayerDot } from "./brand";
import { Confetti } from "./Confetti";

// Wrap a phase block once: every Reveal, Stamp, counter and confetti inside
// follows `staged` (false = render the final state immediately, no motion).
export function RevealScope({ staged, children }: { staged: boolean; children: ReactNode }) {
  return <RevealContext.Provider value={{ delay: 0, staged }}>{children}</RevealContext.Provider>;
}

// (Use <Stamp> for stamps: its tilt is part of its resting style.)
export type RevealKind =
  | "rise" | "fade" | "pop" | "slam" | "drop" | "flip" | "flip-y"
  | "bar-x" | "bar-y" | "neon-on" | "crt-on" | "shake" | "none";

// The one way to stage something. It is in the DOM (and takes its space) from
// the first frame and stays hidden until `delayMs` (plus any parent Reveal's
// delay) by the animation's backwards fill. Never wrap a button in it.
export function Reveal({
  delayMs = 0,
  kind = "rise",
  as = "div",
  className = "",
  style,
  children,
}: {
  delayMs?: number;
  kind?: RevealKind;
  as?: "div" | "span" | "li" | "p";
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const { delay, staged } = useRevealTiming();
  const total = delay + delayMs;
  const animate = staged && kind !== "none";
  return createElement(
    as,
    {
      className: `${animate ? `fx-${kind}` : ""} ${className}`.trim(),
      style: animate ? { ...style, animationDelay: `${total}ms` } : style,
    },
    <RevealContext.Provider value={{ delay: staged ? total : 0, staged }}>{children}</RevealContext.Provider>,
  );
}

export function Stamp({
  tone = "glow",
  size = "md",
  delayMs = 0,
  className = "",
  children,
}: {
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  delayMs?: number;
  className?: string;
  children: ReactNode;
}) {
  const { delay, staged } = useRevealTiming();
  return (
    <span
      className={`stamp stamp-${size} tone-${tone} ${staged ? "fx-stamp" : ""} ${className}`}
      style={staged ? { animationDelay: `${delay + delayMs}ms` } : undefined}
    >
      {children}
    </span>
  );
}

// A number that counts to `value`, writing text directly (no React re-render
// per frame). Start: `from` if given; else the last value this device showed
// for `id`; else 0 when value === gain (first points ever); else no count.
export function RollingNumber({
  value,
  from,
  id,
  gain,
  delayMs = 0,
  ms = FX.count,
  format = (n: number) => n.toLocaleString(),
  className = "",
}: {
  value: number;
  from?: number;
  id?: string;
  gain?: number;
  delayMs?: number;
  ms?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const { delay, staged } = useRevealTiming();
  const start = useRef<number | null>(null);
  if (start.current === null) {
    const cached = id !== undefined ? shownScores.get(id) : undefined;
    start.current =
      from !== undefined
        ? from
        : cached !== undefined
          ? cached
          : id !== undefined && gain !== undefined && gain > 0 && value === gain
            ? 0
            : value;
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.dataset.v === undefined) {
      el.textContent = format(start.current ?? value);
      el.dataset.v = String(start.current ?? value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (id !== undefined) shownScores.set(id, value);
    const fromV = Number(el.dataset.v ?? value);
    const show = (n: number) => {
      el.textContent = format(n);
      el.dataset.v = String(n);
    };
    if (fromV === value || !staged || prefersReducedMotion()) {
      show(value);
      return;
    }
    let raf = 0;
    let t0 = 0;
    const wait = setTimeout(() => {
      const step = (t: number) => {
        if (!t0) t0 = t;
        const k = Math.min(1, (t - t0) / ms);
        show(Math.round(fromV + (value - fromV) * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay + delayMs);
    return () => {
      clearTimeout(wait);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, staged]);
  return <span ref={ref} className={`tabular-nums ${className}`} />;
}

// Vote bars: shown highest first; they grow lowest first, so the winner lands last.
export function VoteBars({
  rows,
  delayMs = 0,
  staggerMs = 120,
  tone = "glow",
}: {
  rows: { id: string; label: ReactNode; count: number; tone?: Tone; lead?: boolean }[];
  delayMs?: number;
  staggerMs?: number;
  tone?: Tone;
}) {
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  const max = Math.max(1, ...sorted.map((r) => r.count));
  const n = sorted.length;
  return (
    <div className="flex flex-col gap-2">
      {sorted.map((r, i) => {
        const at = delayMs + stagger(n - 1 - i, n, staggerMs, 1200);
        return (
          <div key={r.id} className="flex items-center gap-3">
            <div className={`w-28 shrink-0 truncate text-sm font-semibold ${r.lead ? "text-gold" : ""}`}>{r.label}</div>
            <div className="vote-track flex-1">
              <Reveal
                kind="bar-x"
                delayMs={at}
                className="vote-fill"
                style={{ width: `${(r.count / max) * 100}%`, background: TONE_HEX[r.tone ?? tone] }}
              />
            </div>
            <RollingNumber from={0} value={r.count} delayMs={at} className="w-8 text-right font-mono font-bold" />
          </div>
        );
      })}
    </div>
  );
}

// Who has locked in (never what they picked). A chip pops when it lights.
export function LockInRow({
  players,
  doneIds,
  label = "locked in",
}: {
  players: Player[];
  doneIds: Iterable<string>;
  label?: string;
}) {
  const done = new Set(doneIds);
  const count = players.filter((p) => done.has(p.id)).length;
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-fog text-sm">
        {count}/{players.length} {label}
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {players.map((p) => {
          const on = done.has(p.id);
          return (
            <span key={`${p.id}-${on ? 1 : 0}`} className={`token text-sm ${on ? "is-done pop-in" : ""}`}>
              <PlayerDot id={p.id} name={p.name} size="sm" />
              {p.name}
              {on ? " ✓" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// The phone's own result. Slams in at delayMs; points count up from 0; a loss
// shakes once; `celebrate` adds a small confetti burst.
export function ResultCard({
  tone,
  points,
  big,
  title,
  children,
  celebrate = false,
  delayMs = 0,
}: {
  tone: "win" | "lose" | "neutral";
  points?: number;
  big?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  celebrate?: boolean;
  delayMs?: number;
}) {
  const skin =
    tone === "win" ? "bg-win text-[#03180b]" : tone === "lose" ? "bg-lose text-white" : "bg-card border border-line";
  const headline =
    big ??
    (points !== undefined ? (
      <RollingNumber from={0} value={points} format={(n) => `+${n.toLocaleString()}`} />
    ) : tone === "lose" ? (
      "✗"
    ) : null);
  return (
    <Reveal kind="slam" delayMs={delayMs}>
      <Reveal kind={tone === "lose" ? "shake" : "none"} delayMs={460}>
        <div className={`rounded-2xl p-5 text-center ${skin}`}>
          {headline != null && <div className="text-3xl font-extrabold">{headline}</div>}
          <div className="font-semibold">{title}</div>
          {children}
        </div>
      </Reveal>
      {celebrate && <Confetti pieces={14} />}
    </Reveal>
  );
}

// The phone lobby ("You're in"). `note` replaces the player count line.
export function LobbyWait({
  me,
  players,
  note,
  children,
}: {
  me: Player;
  players: Player[];
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <Marquee title="Player ready" burstKey={players.length} />
      <div className="flex items-center gap-3 max-w-full">
        <PlayerDot id={me.id} name={me.name} size="lg" />
        <h1 className="neon-text text-3xl font-extrabold break-words min-w-0">{me.name}</h1>
      </div>
      <p className="text-fog">
        Waiting for the host to start
        <span key={players.length} aria-hidden className="fx-caret attract">
          ▌
        </span>
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {players.map((p) => (
          <PlayerDot key={p.id} id={p.id} name={p.name} className="pop-in" />
        ))}
      </div>
      {note ?? <p className="text-fog text-sm">{players.length} in the room</p>}
      {children}
    </div>
  );
}

// Teaser for `ms`, then the children slam in. Only Hot Take and Chameleon use it.
export function Drumroll({ ms = FX.drum, tease, children }: { ms?: number; tease: ReactNode; children: ReactNode }) {
  const { delay, staged } = useRevealTiming();
  if (!staged) return <>{children}</>;
  return (
    <div className="relative min-h-20">
      <div aria-hidden className="fx-drum" style={{ animationDuration: `${ms}ms`, animationDelay: `${delay}ms` }}>
        <span className="font-display text-2xl text-fog">{tease}</span>
      </div>
      <Reveal kind="slam" delayMs={ms}>
        {children}
      </Reveal>
    </div>
  );
}

// Slot-machine letter: 8 seeded decoys roll past and it stops on `value`.
// At rest (or unstaged) only `value` shows. Host screen only, never phones.
const REEL = "ABCDEFGHIJKLMNOPRSTW";
export function SlotReel({ value, seed }: { value: string; seed: number }) {
  const { staged } = useRevealTiming();
  const rand = mulberry32(seed);
  const pool = REEL.split("").filter((c) => c !== value);
  const decoys = Array.from({ length: 8 }, () => pool[Math.floor(rand() * pool.length)]);
  return (
    <span className="fx-reel" aria-label={value}>
      <span className="invisible" aria-hidden>
        {value}
      </span>
      <span aria-hidden className={`fx-reel-col ${staged ? "fx-slot" : ""}`}>
        {[...decoys, value].map((c, i) => (
          <span key={i}>{c}</span>
        ))}
      </span>
    </span>
  );
}

// Two expanding rings around a target. Parent must be `relative`.
export function RingBurst({ delayMs = 0, tone = "gold" }: { delayMs?: number; tone?: Tone }) {
  const { delay, staged } = useRevealTiming();
  if (!staged) return null;
  return (
    <span aria-hidden className="fx-ring" style={{ animationDelay: `${delay + delayMs}ms`, borderColor: TONE_HEX[tone] }} />
  );
}

export function Dots() {
  return (
    <span className="fx-dots attract" aria-hidden>
      <span>.</span>
      <span>.</span>
      <span>.</span>
    </span>
  );
}
