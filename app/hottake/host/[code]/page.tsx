"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips, HostSeatCard } from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope, VoteBars } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { joinNames } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/hottake/PlayerPanel";
import { RoomSays } from "@/app/hottake/RoomSays";
import { REVEAL } from "@/app/hottake/reveal";
import {
  CROWD_POINTS,
  FAME_POINTS,
  HotTakePhaseData,
  HotTakeResult,
} from "@/app/hottake/constants";

type HotTakeRound = { p: string };

export default function HotTakeHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("hottake", code);
  const { tvRef } = useSpectator();
  const seat = useHostSeat("hottake", code, players, refresh, playersLoaded);
  // Visual only: should this screen play the staged reveal for the current phase?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);
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
    if (tvRef.current) return;
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
  const top = phaseData.top ?? [];

  return (
    <Shell title="Hot Take · host" icon="🔥" attractKey={room.phase === "lobby" ? players.length : undefined}>
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Hot Take → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 3} attention={players.length >= 3}>
            {players.length < 3
              ? "Need at least 3 players…"
              : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds}
          </p>
          <div className="neon-panel p-6 text-center">
            <div className="text-fog text-sm uppercase tracking-widest mb-1">
              Who&apos;s most likely to…
            </div>
            <h1 className="text-2xl font-extrabold">{round.p}</h1>
          </div>
          {seat.canPlay && seat.playerId ? (
            <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
              <PlayerPanel room={room} players={players} subs={subs} playerId={seat.playerId} conceal />
            </div>
          ) : (
            <p className="text-fog text-center text-sm">Vote on your phones. Choose wisely.</p>
          )}
          <LockInRow players={players} doneIds={answered.map((s) => s.player_id)} label="voted" />
          <BigBtn onClick={reveal} disabled={busy || answered.length === 0} color="ghost">
            Reveal now ({answered.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{totalRounds}
            </p>
            <RoomSays names={joinNames(top.map(nameOf)) || "Nobody?!"} tie={top.length > 1} prompt={round.p} />
            {countRows.length > 0 && (
              <Reveal kind="fade" delayMs={REVEAL.bars} className="rounded-xl bg-card border border-line p-3">
                <VoteBars
                  rows={countRows.map(([id, n]) => ({
                    id,
                    label: nameOf(id),
                    count: n,
                    lead: top.includes(id),
                    tone: top.includes(id) ? ("gold" as const) : undefined,
                  }))}
                />
              </Reveal>
            )}
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} gains={gains} highlightId={seat.playerId} />
            </Reveal>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next round"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={seat.playerId} size="host" staged={staged}>
          <Link href="/hottake/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}
