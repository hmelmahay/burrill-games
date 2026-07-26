"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "@/lib/supabase";
import { useSpectator } from "@/lib/useSpectator";

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

export function CodeBadge({ code, game }: { code: string; game?: string }) {
  const { tv } = useSpectator();
  return (
    <div className="rounded-2xl border-2 border-glow bg-card p-4 text-center">
      <div className="text-xs text-fog uppercase tracking-[0.3em]">Join code</div>
      <div className="text-6xl font-extrabold font-mono tracking-[0.2em] text-glow">
        {code}
      </div>
      <div className="text-fog text-xs mt-2">
        Playing too? Join with this code from your phone — this screen is just the
        room&apos;s scoreboard, and anyone can run it.
      </div>
      {/* Hosting on the same device is normal, so give it a real button rather
          than expecting someone to type the URL by hand. Never on the TV. */}
      {game && !tv && (
        <a
          href={`/${game}/play?code=${code}`}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-block rounded-xl border-2 border-violet px-5 py-2 font-bold hover:bg-violet/10"
        >
          🎮 Join this game
        </a>
      )}
      <TvHint />
    </div>
  );
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
