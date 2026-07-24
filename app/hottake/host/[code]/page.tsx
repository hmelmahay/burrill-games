"use client";

import { useRef, useState, use, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips } from "@/app/components/ui";
import {
  CROWD_POINTS,
  FAME_POINTS,
  HotTakePhaseData,
  HotTakeResult,
} from "@/app/hottake/constants";

type HotTakeRound = { p: string };

export default function HotTakeHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("hottake", code);
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number };
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as HotTakeRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as HotTakePhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "vote", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function reveal() {
    if (!room || !round || room.phase !== "vote") return;
    if (revealingRef.current === room.round_idx) return;
    revealingRef.current = room.round_idx;
    setBusy(true);

    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx);
    const rows = (subRows ?? []) as { player_id: string; payload: { target?: string } }[];

    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      if (r.payload.target) counts[r.payload.target] = (counts[r.payload.target] ?? 0) + 1;
    });
    const max = Math.max(0, ...Object.values(counts));
    const top = Object.keys(counts).filter((id) => counts[id] === max && max > 0);

    const results: HotTakeResult[] = players.map((p) => {
      const target = rows.find((r) => r.player_id === p.id)?.payload.target ?? null;
      let gained = 0;
      if (target && top.includes(target)) gained += CROWD_POINTS;
      if (top.includes(p.id)) gained += FAME_POINTS;
      return { player_id: p.id, name: p.name, gained, target };
    });

    await Promise.all(
      results
        .filter((r) => r.gained > 0)
        .map((r) => {
          const p = players.find((x) => x.id === r.player_id);
          return supabase
            .from("arcade_players")
            .update({ score: (p?.score ?? 0) + r.gained })
            .eq("id", r.player_id);
        }),
    );

    await supabase
      .from("arcade_rooms")
      .update({ phase: "reveal", phase_data: { counts, top, results } })
      .eq("id", room.id);
    setBusy(false);
  }

  useEffect(() => {
    if (room?.phase === "vote" && players.length > 0 && answered.length >= players.length) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered.length, players.length, room?.phase]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalRounds;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "vote", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Hot Take" icon="🔥"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Hot Take" icon="🔥"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const countRows = Object.entries(phaseData.counts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <Shell title="Hot Take · host" icon="🔥">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Hot Take → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 3}>
            {players.length < 3 ? "Need at least 3 players…" : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds} · {answered.length}/{players.length} voted
          </p>
          <div className="rounded-2xl bg-card border-2 border-glow p-6 text-center">
            <div className="text-fog text-sm uppercase tracking-widest mb-1">
              Who&apos;s most likely to…
            </div>
            <h1 className="text-2xl font-extrabold">{round.p}</h1>
          </div>
          <p className="text-fog text-center text-sm">Vote on your phones. Choose wisely.</p>
          <BigBtn onClick={reveal} disabled={busy || answered.length === 0} color="ghost">
            Reveal now ({answered.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds} · who&apos;s most likely to {round.p}
          </p>
          <div className="rounded-2xl bg-card border-2 border-glow p-5 text-center">
            <div className="text-4xl">🏅</div>
            <div className="text-2xl font-extrabold">
              {(phaseData.top ?? []).map(nameOf).join(" & ") || "Nobody?!"}
            </div>
            <div className="text-fog text-sm">the room has spoken</div>
          </div>
          <div className="rounded-xl bg-card border border-line p-3 text-sm flex flex-col gap-1">
            {countRows.map(([id, n]) => (
              <div key={id} className="flex justify-between">
                <span className="font-semibold">{nameOf(id)}</span>
                <span className="text-fog">
                  {n} vote{n === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next round"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <a href="/hottake/host" className="underline text-fog">
            Play again with a new room
          </a>
        </div>
      )}
    </Shell>
  );
}
