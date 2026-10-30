"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, Game, Card } from "@/lib/needle/types";
import { needleCardKey } from "@/lib/needle/cards";
import { BingoCard } from "@/app/needle/BingoCard";

export default function PlayCard({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const [game, setGame] = useState<Game | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const cardId =
        typeof window !== "undefined"
          ? localStorage.getItem(needleCardKey(code))
          : null;
      if (!cardId) {
        setErr("No card on this device. Go back and join.");
        return;
      }
      const { data: g } = await supabase
        .from("games")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (cancelled) return;
      if (!g) {
        setErr("Game not found.");
        return;
      }
      const { data: c } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .maybeSingle();
      if (cancelled) return;
      setGame(g as Game);
      setCard(c as Card);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // Realtime subscription
  useEffect(() => {
    if (!game) return;
    const ch = supabase
      .channel(`player-${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `code=eq.${code}`,
        },
        (payload) => setGame((g) => (g ? ({ ...g, ...payload.new } as Game) : g)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [game?.id, code]);

  if (err)
    return (
      <main className="dark p-6 flex flex-col gap-4">
        <p className="text-red-600">{err}</p>
        <Link href="/needle/play" className="underline">
          Back to join
        </Link>
      </main>
    );
  if (!game || !card)
    return (
      <main className="dark p-6">
        <p>Loading…</p>
      </main>
    );

  if (game.status === "ended")
    return (
      <main className="dark flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <h1 className="text-3xl font-bold">Game over</h1>
        <p className="text-zinc-500">The host ended the game.</p>
        <Link href="/" className="underline">
          Home
        </Link>
      </main>
    );

  return (
    <main className="dark flex flex-1 flex-col gap-3 p-3 max-w-md mx-auto w-full">
      <BingoCard game={game} card={card} />
    </main>
  );
}
