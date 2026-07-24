"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, BigBtn } from "@/app/components/ui";
import { createRoom, hostKey } from "@/lib/rooms";

export default function TTHostSetup() {
  const router = useRouter();
  const [cycles, setCycles] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setErr(null);
    // Rounds are built at Start time (once we know who's in the lobby).
    const { room, error } = await createRoom("twotruths", [], { cycles });
    if (error || !room) {
      setErr(error ?? "Couldn't create the room.");
      setBusy(false);
      return;
    }
    localStorage.setItem(hostKey(room.code), "true");
    router.push(`/twotruths/host/${room.code}`);
  }

  return (
    <Shell title="Two Truths & a Lie" icon="🤥">
      <div className="flex flex-1 flex-col justify-center gap-6 max-w-sm mx-auto w-full">
        <h1 className="text-3xl font-extrabold text-center">Host Two Truths &amp; a Lie</h1>
        <p className="text-fog text-center text-sm">
          Each round one player writes two truths and one lie about themselves.
          Everyone else sniffs out the lie. No question bank — your friends are the content.
        </p>
        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold">Turns per player</span>
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
