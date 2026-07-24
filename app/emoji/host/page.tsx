"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, shuffle, hostKey } from "@/lib/rooms";
import EMOJI_BANK from "@/lib/content/emoji.json";

const MAX_ROUNDS = 20;

export default function EmojiHostSetup() {
  const router = useRouter();
  const [numRounds, setNumRounds] = useState(10);
  const [guessSeconds, setGuessSeconds] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    const rounds = shuffle(EMOJI_BANK).slice(0, MAX_ROUNDS);
    const { room, error } = await createRoom("emoji", rounds, { numRounds, guessSeconds });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    router.push(`/emoji/host/${room.code}`);
  }

  return (
    <Shell title="Emoji Cinema" icon="🎬">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Emoji Cinema</h1>
        <p className="text-fog text-center text-sm">
          A title told in emoji. Everyone types their guess — typos forgiven, speed rewarded.
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Puzzles</span>
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
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Seconds per puzzle</span>
          <select
            value={guessSeconds}
            onChange={(e) => setGuessSeconds(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={45}>45</option>
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
