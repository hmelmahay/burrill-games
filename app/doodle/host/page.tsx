"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, hostKey, seatCreator } from "@/lib/rooms";

export default function DoodleHostSetup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cycles, setCycles] = useState(1);
  const [drawSeconds, setDrawSeconds] = useState(90);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Rounds are built at Start time once the lobby is full.
    const { room, error } = await createRoom("doodle", [], { cycles, drawSeconds });
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
    await seatCreator("doodle", room.code, name);
    router.push(`/doodle/host/${room.code}`);
  }

  return (
    <Shell title="Doodle Dash" icon="🎨">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Doodle Dash</h1>
        <p className="text-fog text-center text-sm">
          One player sketches on their phone, everyone watches it appear live and races
          to type the answer. Fast guesses score big; the artist scores per correct guess.
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
          <span className="font-semibold">Turns per artist</span>
          <select
            value={cycles}
            onChange={(e) => setCycles(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Seconds per drawing</span>
          <select
            value={drawSeconds}
            onChange={(e) => setDrawSeconds(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
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
