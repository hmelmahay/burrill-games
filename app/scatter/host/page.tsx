"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey, seatCreator } from "@/lib/rooms";
import { SCATTER_LETTERS, SCATTER_CATEGORIES } from "@/lib/content/scatter";

export default function ScatterHostSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numRounds, setNumRounds] = useState(3);
  const [roundSeconds, setRoundSeconds] = useState(60);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Unique letter + 5 fresh categories per round.
    const letters = shuffle(SCATTER_LETTERS).slice(0, numRounds);
    const cats = shuffle(SCATTER_CATEGORIES);
    const rounds = letters.map((letter, i) => ({
      letter,
      categories: cats.slice(i * 5, i * 5 + 5),
    }));
    const { room, error } = await createRoom("scatter", rounds, {
      numRounds,
      roundSeconds,
    });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    try {
      localStorage.setItem(hostKey(room.code), "true");
    } catch {}
    // Creating a room shouldn't lock you out of your own game: if you gave a
    // name, you're seated as a player and the host screen shows your controls.
    await seatCreator("scatter", room.code, name);
    router.push(`/scatter/host/${room.code}`);
  }

  return (
    <Shell title="Scatter Sprint" icon="📝">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Scatter Sprint</h1>
        <p className="text-fog text-center text-sm">
          One letter, five categories, one timer. Unique answers score — duplicates cancel
          out. You judge the shady ones.
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
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Rounds</span>
          <select
            value={numRounds}
            onChange={(e) => setNumRounds(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
            <option value={5}>5</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Seconds per round</span>
          <select
            value={roundSeconds}
            onChange={(e) => setRoundSeconds(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={45}>45</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
            <option value={120}>120</option>
          </select>
        </label>
        <BigBtn onClick={start} disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </BigBtn>
        {err && <p className="text-lose text-sm text-center">{err}</p>}
      </div>
    </Shell>
  );
}
