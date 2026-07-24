"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GameKind } from "@/lib/supabase";
import { joinRoom, playerKey } from "@/lib/rooms";

export function JoinForm({ game, title }: { game: GameKind; title: string }) {
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function join() {
    setErr(null);
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (c.length !== 4 || !n) {
      setErr("Enter the 4-letter code and your name.");
      return;
    }
    setBusy(true);
    const { player, error } = await joinRoom(game, c, n);
    if (error || !player) {
      setErr(error ?? "Couldn't join.");
      setBusy(false);
      return;
    }
    localStorage.setItem(playerKey(c), player.id);
    router.push(`/${game}/play/${c}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <input
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
          }
          placeholder="CODE"
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="rounded-xl border-2 border-glow bg-card px-4 py-4 text-center text-3xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          autoComplete="off"
          className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-fog/40"
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <button
          onClick={join}
          disabled={busy}
          className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
        >
          {busy ? "Joining…" : "Join"}
        </button>
        {err && <p className="text-lose text-sm text-center">{err}</p>}
      </div>
    </div>
  );
}
