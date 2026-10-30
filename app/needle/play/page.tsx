"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, Game } from "@/lib/needle/types";
import { claimCard, needleCardKey, needleNameKey } from "@/lib/needle/cards";

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
      <h1 className="text-4xl font-bold">Join</h1>
      <div className="flex flex-col gap-3 w-full max-w-xs">
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
          className="rounded-lg border-2 border-black dark:border-white bg-white dark:bg-zinc-900 px-4 py-4 text-center text-3xl font-mono tracking-widest uppercase"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="off"
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3"
        />
        <button
          onClick={join}
          disabled={busy}
          className="rounded-lg bg-black dark:bg-white text-white dark:text-black py-4 font-semibold disabled:opacity-40"
        >
          {busy ? "Joining…" : "Join"}
        </button>
        <p className="text-xs text-zinc-500 text-center">
          Code: {code.length}/4 · Name: {name.trim() ? "✓" : "missing"}
        </p>
        {err && <p className="text-red-600 text-sm text-center">{err}</p>}
      </div>
    </main>
  );
}
