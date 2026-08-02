"use client";

import { useState } from "react";
import { supabase, Room } from "@/lib/supabase";

// One bookmarkable address for the big screen: type the room code and this
// forwards to the right game's host screen in read-only ?tv=1 mode.
// Room codes are unique across every game, so the code alone is enough.
export default function TvEntry() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function go(c: string) {
    if (busy) return;
    if (c.length !== 4) {
      setErr("Room codes are 4 characters.");
      return;
    }
    setBusy(true);
    setErr(null);
    const { data } = await supabase
      .from("arcade_rooms")
      .select("game,code,status")
      .eq("code", c)
      .maybeSingle();
    const room = data as Pick<Room, "game" | "code" | "status"> | null;
    if (room) {
      if (room.status === "ended") {
        setErr("That game already ended.");
        setBusy(false);
        return;
      }
      window.location.href = `/${room.game}/host/${room.code}?tv=1`;
      return;
    }
    // Not an arcade room — maybe it's a Needle Drop (music bingo) game.
    const { data: nd } = await supabase
      .from("games")
      .select("code,status")
      .eq("code", c)
      .maybeSingle();
    const ndGame = nd as { code: string; status: string } | null;
    if (!ndGame) {
      setErr("No room with that code. Double-check it?");
      setBusy(false);
      return;
    }
    if (ndGame.status === "ended") {
      setErr("That game already ended.");
      setBusy(false);
      return;
    }
    window.location.href = `/needle/host/game/${ndGame.code}?tv=1`;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-5xl">📺</div>
      <h1 className="text-3xl font-extrabold text-center">Big-screen scoreboard</h1>
      <p className="text-fog text-center max-w-sm">
        Enter the room code from the host&apos;s screen. This TV becomes the room&apos;s
        scoreboard — no buttons, no spoilers, works for every game.
      </p>
      {/* A real form with a submit button: TV keyboards often commit the whole
          code at once (no per-key onChange), so auto-navigating on the 4th
          keystroke never fires there. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(code);
        }}
        className="flex flex-col items-center gap-4"
      >
        <input
          value={code}
          onChange={(e) => {
            const c = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
            setCode(c);
            if (c.length === 4) go(c);
          }}
          placeholder="CODE"
          maxLength={4}
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className="rounded-xl border-2 border-glow bg-card px-4 py-5 text-center text-4xl font-mono tracking-[0.3em] uppercase placeholder:text-fog/40 w-64"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-glow px-8 py-4 text-lg font-bold text-[#1a1000] disabled:opacity-40 transition hover:brightness-110"
        >
          Open scoreboard →
        </button>
      </form>
      {busy && <p className="text-fog">Finding the room…</p>}
      {err && <p className="text-lose text-center">{err}</p>}
      <p className="text-fog text-xs text-center max-w-xs">
        Tip: bookmark this page on your TV — the address never changes.
      </p>
    </main>
  );
}
