"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GameKind } from "@/lib/supabase";
import { joinRoom, playerKey } from "@/lib/rooms";
import { GAME_META } from "@/lib/games";
import { Marquee } from "./brand";

// `title` is still accepted so the 11 play/page.tsx wrappers need no edits;
// the name and icon now come from the registry.
export function JoinForm({ game }: { game: GameKind; title?: string }) {
  const params = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase());
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const meta = GAME_META[game];
  // A double Enter or tap mid-join would seat this person twice.
  const joiningRef = useRef(false);

  async function join() {
    setErr(null);
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (c.length !== 4 || !n) {
      setErr("Enter the 4-letter code and your name.");
      return;
    }
    if (joiningRef.current) return;
    joiningRef.current = true;
    setBusy(true);
    const { player, error } = await joinRoom(game, c, n);
    if (error || !player) {
      setErr(error ?? "Couldn't join.");
      joiningRef.current = false;
      setBusy(false);
      return;
    }
    localStorage.setItem(playerKey(c), player.id);
    router.push(`/${game}/play/${c}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      {/* Lined up with the form, not the far edge of a laptop screen. */}
      <div className="w-full max-w-xs">
        <Link href="/" className="text-sm text-fog">
          ← games
        </Link>
      </div>
      <Marquee icon={meta.icon} title={meta.name} size="lg" burstKey="join" />
      <div className="neon-panel fx-rise flex flex-col gap-3 w-full max-w-xs p-4">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="CODE"
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="rounded-xl border-2 border-glow bg-ink px-4 py-4 text-center text-3xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40"
          style={{ boxShadow: "inset 0 3px 10px rgba(0,0,0,.6)" }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          autoComplete="off"
          className="rounded-xl border border-line bg-card px-4 py-3 text-base placeholder:text-fog/40"
          onKeyDown={(e) => e.key === "Enter" && join()}
        />
        <button onClick={join} disabled={busy} className="coin-btn coin-glow disabled:opacity-40">
          <span className="coin-face py-4 text-lg">{busy ? "Joining…" : "Join"}</span>
        </button>
        {err && (
          <p key={err} className="fx-shake text-lose text-sm text-center">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
