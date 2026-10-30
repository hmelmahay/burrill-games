"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Player } from "@/lib/supabase";
import { useSpectator } from "@/lib/useSpectator";
import type { HostSeat } from "@/lib/useHostSeat";
import { FX, competitionRanks } from "@/lib/fx";
import { prefersReducedMotion, useFlip, useRevealTiming, useSettledOrder } from "@/lib/motion";
import { Marquee, PlayerDot } from "./brand";
import { Dots, RollingNumber, Stamp } from "./fx";

export function Shell({
  title,
  icon,
  attractKey,
  children,
}: {
  title: string;
  icon: string;
  attractKey?: string | number;
  children: React.ReactNode;
}) {
  const { tv } = useSpectator();
  const cut = title.indexOf(" · ");
  const game = cut < 0 ? title : title.slice(0, cut);
  const suffix = cut < 0 ? null : title.slice(cut + 3);
  // The full-width wrapper clips sideways at the screen edge: a slam or stamp
  // waits at up to 2x size and must not widen a phone page.  clip (not hidden)
  // makes no scroll box, so Chain Gang's sticky docks still stick.
  return (
    <div className="flex flex-1 flex-col overflow-x-clip">
      <main className={`shell flex flex-1 flex-col gap-4 p-4 max-w-2xl mx-auto w-full ${tv ? "tv-mode" : ""}`}>
        <div aria-hidden className="fx-floor" />
        <div className="shell-head flex items-center gap-2">
          <Link href="/" aria-label="Back to games" className="tv-hide shrink-0 px-1 text-sm text-fog">
            ←<span className="hidden sm:inline"> games</span>
          </Link>
          <Marquee icon={icon} title={game} burstKey={attractKey} className="min-w-0" />
          <span className="flex-1" />
          {tv && (
            <span className="shrink-0 rounded-full border border-violet px-2 py-0.5 text-sm text-violet">
              📺 TV scoreboard
            </span>
          )}
          {suffix && (
            // Capped so a long player name can't squeeze the game's sign.
            <span className="min-w-0 max-w-[40%] truncate rounded-full border border-line px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-fog">
              {suffix}
            </span>
          )}
        </div>
        {children}
      </main>
    </div>
  );
}

export function CodeBadge({ code }: { code: string }) {
  return (
    <div className="neon-panel fx-crt-on acc-orange p-4 text-center">
      <span aria-hidden className="code-ring attract" />
      <div className="text-xs text-fog uppercase tracking-[0.3em]">Join code</div>
      <div className="code-tiles mt-2 text-5xl sm:text-6xl" role="img" aria-label={`Join code ${code.split("").join(" ")}`}>
        {code.split("").map((ch, i) => (
          <span key={i} aria-hidden className="code-tile" style={{ animationDelay: `${120 + i * 70}ms` }}>
            {ch}
          </span>
        ))}
      </div>
      <div className="text-fog text-xs mt-3">Everyone else joins from their phone with this code.</div>
      <TvHint />
    </div>
  );
}

// Lobby card that seats whoever is running the host screen, so they play on
// this device instead of joining again from a second phone or tab.
export function HostSeatCard({ seat }: { seat: HostSeat }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (seat.tv) return null;

  async function run(action: () => Promise<string | null>) {
    setBusy(true);
    setErr(await action());
    setBusy(false);
  }

  if (seat.checking)
    return (
      <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 text-fog text-sm">🎮 Checking your seat…</div>
    );

  if (seat.me)
    return (
      <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <PlayerDot id={seat.me.id} name={seat.me.name} />
          <div className="min-w-0">
            <div className="font-bold truncate">🎮 You&apos;re playing as {seat.me.name}</div>
            <div className="text-fog text-xs">Your turns show up right here on this screen.</div>
            {err && <p className="text-lose text-xs mt-1">{err}</p>}
          </div>
        </div>
        <button onClick={() => run(seat.leave)} disabled={busy} className="coin-btn coin-ghost shrink-0 disabled:opacity-40">
          <span className="coin-face px-3 py-2 text-xs">Just host</span>
        </button>
      </div>
    );

  return (
    <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 flex flex-col gap-2">
      <div className="font-bold">🎮 Playing too?</div>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2"
          onKeyDown={(e) => e.key === "Enter" && !busy && run(() => seat.sit(name))}
        />
        <button
          onClick={() => run(() => seat.sit(name))}
          disabled={busy || !name.trim()}
          className="coin-btn coin-violet shrink-0 disabled:opacity-40"
        >
          <span className="coin-face px-4 py-2">{busy ? "Joining…" : "Join here"}</span>
        </button>
      </div>
      <div className="text-fog text-xs">
        Play on this screen. No second phone or tab needed. Skip it to keep this screen as just the scoreboard.
      </div>
      {err && <p className="text-lose text-sm">{err}</p>}
    </div>
  );
}

// Keeps something only this seat should see behind a tap, for a host screen
// the room can see too (Chameleon's role peek, generalized). Give it a `key`
// that changes each round so it closes again on its own.
export function PeekGuard({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <div className="flex flex-col items-center gap-2 py-2">
        <p className="text-fog text-sm">Hidden, since others can see this screen.</p>
        <button onClick={() => setOpen(true)} className="coin-btn coin-ghost">
          <span className="coin-face px-6 py-3 border-violet text-white">🫣 {label}</span>
        </button>
      </div>
    );
  return (
    <div className="pop-in flex flex-col gap-2">
      {children}
      <button onClick={() => setOpen(false)} className="text-fog text-sm underline">
        Hide it again
      </button>
    </div>
  );
}

// For a seated host typing on a screen the room can see: inputs show dots
// unless the host flips the toggle to check what they typed.
export function useMaskedTyping(conceal?: boolean) {
  const [show, setShow] = useState(false);
  const inputClass = conceal && !show ? "type-masked" : "";
  const toggle = conceal ? (
    <button type="button" onClick={() => setShow((v) => !v)} className="self-center text-fog text-xs underline">
      {show ? "Hide what I'm typing" : "Show what I'm typing"}
    </button>
  ) : null;
  return { inputClass, toggle };
}

// Shows the big-screen entry address (hidden on the TV itself). The /tv page
// is the same for every game and room: bookmark once, then just type the code.
function TvHint() {
  const { tv } = useSpectator();
  const [host, setHost] = useState("");
  useEffect(() => {
    setHost(window.location.host);
  }, []);
  if (tv || !host) return null;
  return (
    <div className="text-fog text-xs mt-1.5">
      📺 Got a TV? Open <span className="font-mono text-glow">{host}/tv</span> in its browser and enter this code — instant
      controls-free scoreboard.
    </div>
  );
}

export function BigBtn({
  onClick,
  disabled,
  color = "glow",
  attention = false,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  color?: "glow" | "violet" | "win" | "lose" | "ghost";
  attention?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`coin-btn coin-${color} disabled:opacity-40 ${attention && !disabled ? "fx-attention attract" : ""}`}
    >
      <span className="coin-face px-4 py-4 text-lg">{children}</span>
    </button>
  );
}

// A burning fuse: glides with a 1s linear transform each second instead of
// stepping, and snaps (no sweep) on mount or whenever `left` goes back up
// (a Chain Gang duel turn), so a mounted bar never visibly refills.
export function Fuse({
  left,
  total,
  color,
  slim = false,
  className = "",
}: {
  left: number;
  total: number;
  color: string;
  slim?: boolean;
  className?: string;
}) {
  const [prev, setPrev] = useState(left);
  const [epoch, setEpoch] = useState(0);
  if (left !== prev) {
    if (left > prev) setEpoch((e) => e + 1);
    setPrev(left);
  }
  return (
    <div className={`fuse ${slim ? "fuse-slim" : ""} ${className}`}>
      <FuseFill key={epoch} left={left} total={total} color={color} />
    </div>
  );
}

function FuseFill({ left, total, color }: { left: number; total: number; color: string }) {
  const [glide, setGlide] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setGlide(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  // `left` is whole seconds rounded up, so aim one second ahead and glide there.
  const target = glide ? left - 1 : left;
  const frac = total > 0 ? Math.min(1, Math.max(0, target / total)) : 0;
  return (
    <div
      className="fuse-fill"
      style={{
        transform: `scaleX(${frac})`,
        transition: glide ? "transform 1s linear" : "none",
        background: color,
      }}
    />
  );
}

export function Countdown({
  left,
  total,
  doneLabel = "Time!",
}: {
  left: number;
  total: number;
  doneLabel?: string | null;
}) {
  const color = left <= 5 ? "#e74c3c" : left <= 10 ? "#ff9f1c" : "#2ecc71";
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Fuse left={left} total={total} color={color} />
        {left === 0 && doneLabel && (
          <div className="pointer-events-none absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center">
            <Stamp tone="lose" size="sm">
              {doneLabel}
            </Stamp>
          </div>
        )}
      </div>
      <span className="font-mono text-2xl font-bold min-w-12 text-right tabular-nums">
        <span key={left <= 5 ? left : "n"} className={left <= 5 && left > 0 ? "fx-tick" : ""}>
          {left}s
        </span>
      </span>
    </div>
  );
}

export function MiniTimer({ left, total, label }: { left: number; total: number; label: string }) {
  return (
    <div className="flex items-center gap-2 text-fog text-sm">
      <span className="whitespace-nowrap">{label}</span>
      <Fuse left={left} total={total} color="#7c5cff" slim className="flex-1" />
      <span className="font-mono font-bold w-8 text-right tabular-nums">{left}s</span>
    </div>
  );
}

// High-score table. Same props as before plus `size`. Ties share a rank;
// 1ST/2ND/3RD badges only above 0; the crown only for a sole leader with points.
// Scores count up from what this screen last showed; rows slide to new ranks.
export function Leaderboard({
  players,
  highlightId,
  gains,
  size = "md",
}: {
  players: Player[];
  highlightId?: string | null;
  gains?: Record<string, number>;
  size?: "md" | "lg";
}) {
  const { delay, staged } = useRevealTiming();
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const ranks = competitionRanks(sorted.map((p) => p.score));
  const rankOf = new Map(sorted.map((p, i) => [p.id, ranks[i]]));
  const leaders = sorted.filter((p, i) => ranks[i] === 1 && p.score > 0);
  const cacheKey = players
    .map((p) => p.id)
    .sort()
    .join(",");
  const order = useSettledOrder(
    sorted.map((p) => p.id),
    { cacheKey, staged, startDelay: delay },
  );
  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, order.join(","));
  const rows = order.map((id) => players.find((p) => p.id === id)).filter((p): p is Player => !!p);
  // Until the rows slide into the new order they still show last round's
  // standings (old order, numbers not yet counted), so badges and the crown
  // follow the shown order too and change with the slide.
  const settled = order.join(",") === sorted.map((p) => p.id).join(",");
  const soleLeader = settled ? (leaders.length === 1 ? leaders[0].id : null) : (rows[0]?.id ?? null);
  const big = size === "lg";
  return (
    <ol ref={listRef} className="flex flex-col gap-1.5">
      {rows.map((p, i) => {
        const rank = settled ? (rankOf.get(p.id) ?? i + 1) : i + 1;
        const badge = p.score > 0 && rank <= 3;
        const gain = gains?.[p.id];
        // Staggered by final standing, which doesn't change while rows re-sort.
        const at = sorted.findIndex((s) => s.id === p.id);
        return (
          <li
            key={p.id}
            data-flip-id={p.id}
            className={`hiscore-row gap-3 ${big ? "px-5 py-3 text-2xl" : ""} ${p.id === highlightId ? "is-me" : ""} ${
              soleLeader === p.id && p.score > 0 ? "is-leader" : ""
            }`}
          >
            <span className={`${big ? "w-16" : "w-11"} shrink-0 text-center`}>
              {badge ? (
                <span className={`rank-badge rank-${rank}`}>{["1ST", "2ND", "3RD"][rank - 1]}</span>
              ) : (
                <span className="font-bold text-fog">{rank}</span>
              )}
            </span>
            <PlayerDot id={p.id} name={p.name} size={big ? "lg" : "sm"} />
            <span className="flex-1 font-semibold truncate">
              {soleLeader === p.id && p.score > 0 ? "👑 " : ""}
              {p.name}
            </span>
            {gain != null && gain !== 0 && (
              <GainChip
                key={`${p.id}:${gain}`}
                gain={gain}
                delayMs={staged ? delay + 200 + Math.max(0, at) * FX.stagger : null}
              />
            )}
            <RollingNumber id={p.id} value={p.score} gain={gain} delayMs={200} className="font-mono font-bold" />
          </li>
        );
      })}
      {rows.length === 0 && <p className="text-fog text-sm">Nobody yet…</p>}
    </ol>
  );
}

// Pops in once, `delayMs` after mount (null: no motion).  Web Animations, not a
// CSS class:  React moves a row's node when the board re-sorts, a moved node
// restarts its CSS animations, and the chip vanished and popped in again.
function GainChip({ gain, delayMs }: { gain: number; delayMs: number | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (delayMs == null || !el || typeof el.animate !== "function") return;
    const still = prefersReducedMotion();
    const a = el.animate(
      still
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(14px) scale(0.9)" },
            { opacity: 1, transform: "translateY(-3px) scale(1.08)", offset: 0.55 },
            { opacity: 1, transform: "none" },
          ],
      { duration: still ? 1 : 450, delay: delayMs, easing: "ease-out", fill: "backwards" },
    );
    return () => a.cancel();
    // Plays once per chip; the key changes when the gain does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <span ref={ref} className={`gain-chip ${gain < 0 ? "is-neg" : ""}`}>
      {gain > 0 ? "+" : ""}
      {gain.toLocaleString()}
    </span>
  );
}

export function PlayerChips({ players }: { players: Player[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <span key={p.id} className="token pop-in text-sm">
          <PlayerDot id={p.id} name={p.name} size="sm" />
          {p.name}
        </span>
      ))}
      {players.length === 0 && (
        <span className="text-fog text-sm">
          Waiting for players to join
          <Dots />
        </span>
      )}
    </div>
  );
}
