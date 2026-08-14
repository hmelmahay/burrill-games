"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, hostKey, joinRoom, playerKey } from "@/lib/rooms";

export default function ChameleonHostSetup() {
  const router = useRouter();
  const [roundCount, setRoundCount] = useState(5);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Rounds get built at Start, once the lobby is full.
    const { room, error } = await createRoom("chameleon", [], { roundCount });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    // Creating a room shouldn't lock you out of your own game: if you gave a
    // name, you're seated as a player and the host screen shows your controls.
    const n = name.trim();
    if (n) {
      const { player, error: jErr } = await joinRoom("chameleon", room.code, n);
      if (jErr || !player) {
        setErr(jErr ?? "Room made, but couldn't seat you as a player.");
        setBusy(false);
        return;
      }
      localStorage.setItem(playerKey(room.code), player.id);
    }
    router.push(`/chameleon/host/${room.code}`);
  }

  return (
    <Shell title="Chameleon" icon="🦎">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Chameleon</h1>
        <p className="text-fog text-center text-sm">
          Everyone sees a card of 16 words. All but one player know which word is
          secret — the Chameleon has to bluff. Go around saying one related word
          each, then vote on who&apos;s faking it.
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
            Leave blank to run this screen as a scoreboard only. If you play from
            here, your role hides behind a peek button.
          </span>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Rounds</span>
          <select
            value={roundCount}
            onChange={(e) => setRoundCount(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={8}>8</option>
            <option value={10}>10</option>
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
