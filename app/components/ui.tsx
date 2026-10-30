"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "@/lib/supabase";
import { useSpectator } from "@/lib/useSpectator";
import type { HostSeat } from "@/lib/useHostSeat";

export function Shell({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  const { tv } = useSpectator();
  return (
    <main
      className={`flex flex-1 flex-col gap-4 p-4 max-w-2xl mx-auto w-full ${
        tv ? "tv-mode" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-fog underline">
          ← games
        </Link>
        <span className="text-sm font-semibold text-fog">
          {tv && (
            <span className="mr-2 rounded-full border border-violet px-2 py-0.5 text-violet">
              📺 TV scoreboard
            </span>
          )}
          {icon} {title}
        </span>
      </div>
      {children}
    </main>
  );
}

export function CodeBadge({ code }: { code: string }) {
  return (
    <div className="rounded-2xl border-2 border-glow bg-card p-4 text-center">
      <div className="text-xs text-fog uppercase tracking-[0.3em]">Join code</div>
      <div className="text-6xl font-extrabold font-mono tracking-[0.2em] text-glow">
        {code}
      </div>
      <div className="text-fog text-xs mt-2">
        Everyone else joins from their phone with this code.
      </div>
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
      <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 text-fog text-sm">
        🎮 Checking your seat…
      </div>
    );

  if (seat.me)
    return (
      <div className="rounded-2xl border-2 border-violet bg-card/60 p-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-bold">🎮 You&apos;re playing as {seat.me.name}</div>
          <div className="text-fog text-xs">
            Your turns show up right here on this screen.
          </div>
          {err && <p className="text-lose text-xs mt-1">{err}</p>}
        </div>
        <button
          onClick={() => run(seat.leave)}
          disabled={busy}
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs text-fog hover:border-lose disabled:opacity-40"
        >
          Just host
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
          className="shrink-0 rounded-lg bg-violet text-white px-4 py-2 font-bold disabled:opacity-40"
        >
          {busy ? "Joining…" : "Join here"}
        </button>
      </div>
      <div className="text-fog text-xs">
        Play on this screen. No second phone or tab needed. Skip it to keep this
        screen as just the scoreboard.
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
        <button
          onClick={() => setOpen(true)}
          className="rounded-xl border-2 border-violet px-6 py-3 font-bold hover:bg-violet/10"
        >
          🫣 {label}
        </button>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
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
    <button
      type="button"
      onClick={() => setShow((v) => !v)}
      className="self-center text-fog text-xs underline"
    >
      {show ? "Hide what I'm typing" : "Show what I'm typing"}
    </button>
  ) : null;
  return { inputClass, toggle };
}

// Shows the big-screen entry address (hidden on the TV itself). The /tv page
// is the same for every game and room — bookmark once, then just type the code.
function TvHint() {
  const { tv } = useSpectator();
  const [host, setHost] = useState("");
  useEffect(() => {
    setHost(window.location.host);
  }, []);
  if (tv || !host) return null;
  return (
    <div className="text-fog text-xs mt-1.5">
      📺 Got a TV? Open <span className="font-mono text-glow">{host}/tv</span> in
      its browser and enter this code — instant controls-free scoreboard.
    </div>
  );
}

export function BigBtn({
  onClick,
  disabled,
  color = "glow",
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  color?: "glow" | "violet" | "win" | "lose" | "ghost";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    glow: "bg-glow text-[#1a1000]",
    violet: "bg-violet text-white",
    win: "bg-win text-[#03180b]",
    lose: "bg-lose text-white",
    ghost: "bg-transparent border-2 border-line text-fog",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl py-4 px-4 font-bold text-lg disabled:opacity-40 transition hover:brightness-110 ${styles[color]}`}
    >
      {children}
    </button>
  );
}

export function Countdown({ left, total }: { left: number; total: number }) {
  const pct = total > 0 ? (left / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 rounded-full bg-line overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            left <= 5 ? "bg-lose" : "bg-win"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-2xl font-bold w-12 text-right">{left}s</span>
    </div>
  );
}

// Slim between-phases countdown ("Next question in ▁▁▁ 5s") — quiet enough
// to sit under a reveal without stealing it.
export function MiniTimer({
  left,
  total,
  label,
}: {
  left: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? (left / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-fog text-sm">
      <span className="whitespace-nowrap">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-line overflow-hidden">
        <div
          className="h-full rounded-full bg-violet transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono font-bold w-8 text-right">{left}s</span>
    </div>
  );
}

export function Leaderboard({
  players,
  highlightId,
  gains,
}: {
  players: Player[];
  highlightId?: string | null;
  gains?: Record<string, number>;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <ol className="flex flex-col gap-1.5">
      {sorted.map((p, i) => (
        <li
          key={p.id}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
            p.id === highlightId ? "bg-violet/25 border border-violet" : "bg-card border border-line"
          }`}
        >
          <span className="w-7 text-center font-bold text-fog">
            {i === 0 ? "👑" : i + 1}
          </span>
          <span className="flex-1 font-semibold truncate">{p.name}</span>
          {gains && gains[p.id] != null && gains[p.id] !== 0 && (
            <span className={`text-sm font-bold ${gains[p.id] > 0 ? "text-win" : "text-lose"}`}>
              {gains[p.id] > 0 ? "+" : ""}
              {gains[p.id]}
            </span>
          )}
          <span className="font-mono font-bold">{p.score}</span>
        </li>
      ))}
      {sorted.length === 0 && <p className="text-fog text-sm">Nobody yet…</p>}
    </ol>
  );
}

export function PlayerChips({ players }: { players: Player[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {players.map((p) => (
        <span
          key={p.id}
          className="pop-in rounded-full bg-card border border-line px-3 py-1.5 text-sm font-semibold"
        >
          {p.name}
        </span>
      ))}
      {players.length === 0 && (
        <span className="text-fog text-sm">Waiting for players to join…</span>
      )}
    </div>
  );
}
