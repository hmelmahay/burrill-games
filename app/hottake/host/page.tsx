"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey, seatCreator } from "@/lib/rooms";
import HOTTAKE_BANK from "@/lib/content/hottake.json";

const MAX_ROUNDS = 20;

export default function HotTakeHostSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [numRounds, setNumRounds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const rounds = shuffle(HOTTAKE_BANK).slice(0, MAX_ROUNDS);
    const { room, error } = await createRoom("hottake", rounds, { numRounds });
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
    await seatCreator("hottake", room.code, name);
    router.push(`/hottake/host/${room.code}`);
  }

  return (
    <Shell title="Hot Take" icon="🔥">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Hot Take</h1>
        <p className="text-fog text-center text-sm">
          &quot;Who&apos;s most likely to…?&quot; Everyone votes for a player. Points for
          voting with the room — and for being famous.
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
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
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
