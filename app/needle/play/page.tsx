"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, Game } from "@/lib/needle/types";
import { claimCard, needleCardKey, needleNameKey } from "@/lib/needle/cards";
import { GAME_META } from "@/lib/games";
import { Marquee } from "@/app/components/brand";

export default function JoinPage() {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A second tap mid-join would claim a second card for the same person.
  const joiningRef = useRef(false);
  const router = useRouter();

  async function join() {
    if (joiningRef.current) return;
    joiningRef.current = true;
    const ok = await tryJoin();
    if (!ok) joiningRef.current = false;
  }

  async function tryJoin(): Promise<boolean> {
    setErr(null);
    const c = code.trim().toUpperCase();
    const n = name.trim();
    if (c.length !== 4 || !n) {
      setErr("Enter a 4-char code and your name.");
      return false;
    }
    setBusy(true);

    const { data: game, error: gErr } = await supabase
      .from("games")
      .select("*")
      .eq("code", c)
      .maybeSingle();
    if (gErr || !game) {
      setErr("Game not found.");
      setBusy(false);
      return false;
    }
    const g = game as Game;
    if (g.status === "ended") {
      setErr("That game has ended.");
      setBusy(false);
      return false;
    }

    const { card, error: claimErr } = await claimCard(g.id, n);
    if (claimErr || !card) {
      setErr(claimErr ?? "Couldn't claim a card. Try again.");
      setBusy(false);
      return false;
    }
    // Stash card id locally so the play screen knows who they are.
    if (typeof window !== "undefined") {
      localStorage.setItem(needleCardKey(c), card.id);
      localStorage.setItem(needleNameKey(c), n);
    }
    router.push(`/needle/play/${c}`);
    return true;
  }

  return (
    <main className="dark flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="self-start text-sm text-fog">
        ← games
      </Link>
      <Marquee
        icon={GAME_META.needle.icon}
        title={GAME_META.needle.name}
        size="lg"
        burstKey="join"
      />
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
          inputMode="text"
          className="rounded-xl border-2 border-glow bg-ink px-4 py-4 text-center text-3xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40"
          style={{ boxShadow: "inset 0 3px 10px rgba(0,0,0,.6)" }}
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="off"
          className="rounded-xl border border-line bg-card px-4 py-3 text-base placeholder:text-fog/40"
        />
        <button onClick={join} disabled={busy} className="coin-btn coin-glow disabled:opacity-40">
          <span className="coin-face py-4 text-lg">{busy ? "Joining…" : "Join"}</span>
        </button>
        <p className="text-xs text-fog text-center">
          Code: {code.length}/4 · Name: {name.trim() ? "✓" : "missing"}
        </p>
        {err && (
          <p key={err} className="fx-shake text-lose text-sm text-center">
            {err}
          </p>
        )}
      </div>
    </main>
  );
}
