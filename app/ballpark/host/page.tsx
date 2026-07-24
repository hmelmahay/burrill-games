"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey } from "@/lib/rooms";
import NUMBERS_BANK from "@/lib/content/numbers.json";

const MAX_ROUNDS = 15;

export default function BallparkHostSetup() {
  const router = useRouter();
  const [numRounds, setNumRounds] = useState(10);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const rounds = shuffle(NUMBERS_BANK).slice(0, MAX_ROUNDS);
    const { room, error } = await createRoom("ballpark", rounds, { numRounds });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    router.push(`/ballpark/host/${room.code}`);
  }

  return (
    <Shell title="Ballpark" icon="🎯">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Ballpark</h1>
        <p className="text-fog text-center text-sm">
          Nobody knows how tall the Eiffel Tower is. Closest guess wins the round.
        </p>
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
