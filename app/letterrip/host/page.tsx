"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey, joinRoom, playerKey } from "@/lib/rooms";
import { LETTER_BANK } from "@/lib/content/letterrip";
import { LetterMode, MAX_BOARDS } from "@/app/letterrip/constants";

const MODES: { key: LetterMode; icon: string; name: string; blurb: string }[] = [
  {
    key: "race",
    icon: "🏁",
    name: "Race",
    blurb: "Free-for-all — every answer goes to whoever types it first.",
  },
  {
    key: "teams",
    icon: "⚔️",
    name: "Teams",
    blurb: "Two teams alternate boards; leftovers can be stolen.",
  },
  {
    key: "coop",
    icon: "🤝",
    name: "Team Up",
    blurb: "Everyone together — clear every board before the clock.",
  },
];

export default function LetterRipHostSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<LetterMode>("race");
  const [numBoards, setNumBoards] = useState(6);
  const [boardSeconds, setBoardSeconds] = useState(60);
  const [stealSeconds, setStealSeconds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Deal the max either way, so shrinking/growing settings never re-deals.
    const rounds = shuffle(LETTER_BANK).slice(0, MAX_BOARDS);
    const { room, error } = await createRoom("letterrip", rounds, {
      mode,
      numBoards,
      boardSeconds,
      stealSeconds,
    });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    const n = name.trim();
    if (n) {
      const { player, error: jErr } = await joinRoom("letterrip", room.code, n);
      if (jErr || !player) {
        setErr(jErr ?? "Room made, but couldn't seat you as a player.");
        setBusy(false);
        return;
      }
      localStorage.setItem(playerKey(room.code), player.id);
    }
    router.push(`/letterrip/host/${room.code}`);
  }

  return (
    <Shell title="Letter Rip" icon="🔤">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Letter Rip</h1>
        <p className="text-fog text-sm text-center -mt-3">
          A category, six hidden answers — first letter and blanks are your only
          clues. &ldquo;Tom Cruise movies: T·· G··&rdquo;? TOP GUN!
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Playing too? Enter your name"
            maxLength={20}
            autoComplete="off"
            className="rounded-lg border border-line bg-card px-3 py-2"
          />
          <span className="text-fog text-xs">
            Leave blank to run this screen as a scoreboard only.
          </span>
        </label>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">Mode</span>
          <div className="grid grid-cols-1 gap-2">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`rounded-xl border-2 p-3 text-left ${
                  mode === m.key ? "border-glow bg-glow/10" : "border-line"
                }`}
              >
                <span className="font-bold block">
                  {m.icon} {m.name}
                </span>
                <span className="text-fog text-xs">{m.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            Boards
            {mode === "teams" && (
              <span className="block text-xs text-fog font-normal">
                Teams alternate — an even count keeps it fair
              </span>
            )}
          </span>
          <select
            value={numBoards}
            onChange={(e) => setNumBoards(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={4}>4</option>
            <option value={6}>6</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">
            Time per board
            <span className="block text-xs text-fog font-normal">
              A cleared board ends early
            </span>
          </span>
          <select
            value={boardSeconds}
            onChange={(e) => setBoardSeconds(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={45}>45s</option>
            <option value={60}>60s</option>
            <option value={90}>90s</option>
          </select>
        </label>
        {mode === "teams" && (
          <label className="flex items-center justify-between gap-3">
            <span className="font-semibold">
              Steal window
              <span className="block text-xs text-fog font-normal">
                Whatever's left is up for grabs by the other team
              </span>
            </span>
            <select
              value={stealSeconds}
              onChange={(e) => setStealSeconds(Number(e.target.value))}
              className="rounded-lg border border-line bg-card px-3 py-2"
            >
              <option value={15}>15s</option>
              <option value={20}>20s</option>
              <option value={30}>30s</option>
            </select>
          </label>
        )}
        <BigBtn onClick={start} disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </BigBtn>
        {err && <p className="text-lose text-sm text-center">{err}</p>}
      </div>
    </Shell>
  );
}
