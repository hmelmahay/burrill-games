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
    if (c.length !== 4 || busy) return;
    setBusy(true);
    setErr(null);
    const { data } = await supabase
      .from("arcade_rooms")
      .select("game,code,status")
      .eq("code", c)
      .maybeSingle();
    const room = data as Pick<Room, "game" | "code" | "status"> | null;
    if (!room) {
      setErr("No room with that code. Double-check it?");
      setBusy(false);
      return;
    }
    if (room.status === "ended") {
      setErr("That game already ended.");
      setBusy(false);
      return;
    }
    window.location.href = `/${room.game}/host/${room.code}?tv=1`;
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="text-5xl">📺</div>
      <h1 className="text-3xl font-extrabold text-center">Big-screen scoreboard</h1>
      <p className="text-fog text-center max-w-sm">
        Enter the room code from the host&apos;s screen. This TV becomes the room&apos;s
        scoreboard — no buttons, no spoilers, works for every game.
      </p>
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
      {busy && <p className="text-fog">Finding the room…</p>}
      {err && <p className="text-lose text-center">{err}</p>}
      <p className="text-fog text-xs text-center max-w-xs">
        Tip: bookmark this page on your TV — the address never changes.
      </p>
    </main>
  );
}
