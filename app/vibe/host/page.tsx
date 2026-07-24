"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, hostKey } from "@/lib/rooms";

export default function VibeHostSetup() {
  const router = useRouter();
  const [cycles, setCycles] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Rounds get built at Start, once the lobby is full.
    const { room, error } = await createRoom("vibe", [], { cycles });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    router.push(`/vibe/host/${room.code}`);
  }

  return (
    <Shell title="Vibe Check" icon="🌡️">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Vibe Check</h1>
        <p className="text-fog text-center text-sm">
          One psychic gets a secret spot on a scale — say, Hot ↔ Cold — and writes a
          one-line clue. Everyone else slides their dial to where they think it lands.
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Turns as psychic</span>
          <select
            value={cycles}
            onChange={(e) => setCycles(Number(e.target.value))}
            className="rounded-lg border border-line bg-card px-3 py-2"
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
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
