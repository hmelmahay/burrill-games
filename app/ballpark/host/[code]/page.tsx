"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, BallparkRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips, HostSeatCard } from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope, RollingNumber } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { PlayerDot } from "@/app/components/brand";
import { useStaged } from "@/lib/motion";
import { addBot, removeBot, humansOf, botsOf, botSkill, botNumberGuess, botBlindNumber } from "@/lib/bots";
import { useBotAnswer } from "@/lib/useBotAnswer";
import { useBotSubmissions } from "@/lib/useBots";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/ballpark/PlayerPanel";
import { NumberLine } from "@/app/ballpark/NumberLine";
import { EDGE_CLIP, REVEAL } from "@/app/ballpark/reveal";
import { formatterFor } from "@/app/ballpark/format";
import {
  RANK_POINTS,
  PARTICIPATION_POINTS,
  EXACT_BONUS,
  BallparkPhaseData,
  BallparkResult,
} from "@/app/ballpark/constants";

export default function BallparkHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("ballpark", code);
  const { tvRef } = useSpectator();
  const seat = useHostSeat("ballpark", code, players, refresh, playersLoaded);
  // Display only: should this screen play the reveal, or show its end state?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number };
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as BallparkRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as BallparkPhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);
  const [botErr, setBotErr] = useState<string | null>(null);

  // Bots estimate the answer themselves — they never see round.answer. With no
  // answer service they guess blind rather than peek.
  const { ready: botsReady, answer: botAnswer } = useBotAnswer<{ value: number }>({
    room,
    active: room?.phase === "guess" && !!round,
    tvRef,
    ask:
      room?.phase === "guess" && round
        ? { kind: "ballpark", question: round.q, unit: round.unit }
        : null,
  });

  useBotSubmissions({
    room,
    players,
    roundSubs: answered,
    active: room?.phase === "guess" && !!round && botsReady,
    tvRef,
    makePayload: (bot) => ({
      guess: botAnswer
        ? botNumberGuess(botAnswer.value, botSkill(bot.id))
        : botBlindNumber(),
    }),
  });

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "guess", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function reveal() {
    if (!room || !round || room.phase !== "guess") return;
    if (revealingRef.current === room.round_idx) return;
    revealingRef.current = room.round_idx;
    setBusy(true);

    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx);
    const rows = (subRows ?? []) as { player_id: string; payload: { guess?: number } }[];

    const results: BallparkResult[] = players.map((p) => {
      const g = rows.find((r) => r.player_id === p.id)?.payload.guess;
      const guess = typeof g === "number" && isFinite(g) ? g : null;
      return {
        player_id: p.id,
        name: p.name,
        gained: 0,
        guess,
        distance: guess == null ? null : Math.abs(guess - round.answer),
      };
    });

    // Competition ranking on distance; ties share the same rank's points.
    const guessed = results
      .filter((r) => r.distance != null)
      .sort((a, b) => a.distance! - b.distance!);
    let rank = 0;
    let prevDist: number | null = null;
    guessed.forEach((r, i) => {
      if (prevDist === null || r.distance! > prevDist) {
        rank = i;
        prevDist = r.distance!;
      }
      r.gained = RANK_POINTS[rank] ?? PARTICIPATION_POINTS;
      if (r.distance === 0) r.gained += EXACT_BONUS;
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
      .update({ phase: "reveal", phase_data: { results } })
      .eq("id", room.id);
    setBusy(false);
  }

  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "guess" && players.length > 0 && answered.length >= players.length) {
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
          : { phase: "guess", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Ballpark" icon="🎯"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Ballpark" icon="🎯"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const sortedResults = [...(phaseData.results ?? [])].sort((a, b) => {
    if (a.distance == null) return 1;
    if (b.distance == null) return -1;
    return a.distance - b.distance;
  });
  const bestDistance = sortedResults[0]?.distance ?? null;
  // Years print as 1903, not 1,903.
  const fmt = formatterFor(round);
  const canStart = players.length >= 1 && humansOf(players).length >= 1;

  return (
    <Shell title="Ballpark · host" icon="🎯" attractKey={room.phase === "lobby" ? players.length : undefined}>
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Ballpark → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => setBotErr(room ? await addBot(room, players) : null)}
              className="flex-1 rounded-xl border-2 border-line py-2.5 font-bold hover:border-glow"
            >
              🤖 Add a bot
            </button>
            {botsOf(players).length > 0 && (
              <button
                onClick={async () => setBotErr(await removeBot(players))}
                className="rounded-xl border border-line px-4 py-2.5 text-fog hover:border-lose"
              >
                Remove
              </button>
            )}
          </div>
          {botErr && <p className="text-lose text-sm text-center">{botErr}</p>}
          <BigBtn onClick={startGame} disabled={busy || !canStart} attention={canStart}>
            {humansOf(players).length < 1
              ? "Waiting for a human…"
              : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds}
          </p>
          {botsReady && !botAnswer && botsOf(players).length > 0 && (
            <p className="text-lose text-center text-xs">
              Bots are guessing blind — the answer service is unavailable.
            </p>
          )}
          <div className="neon-panel p-6 text-center">
            <h1 className="text-2xl font-extrabold">{round.q}</h1>
          </div>
          {seat.canPlay && seat.playerId && (
            <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
              <PlayerPanel room={room} subs={subs} playerId={seat.playerId} conceal />
            </div>
          )}
          <LockInRow players={players} doneIds={answered.map((s) => s.player_id)} />
          <p className="text-fog text-center text-sm">
            Closest guess takes the round. Exact answer gets a bonus.
          </p>
          <BigBtn onClick={reveal} disabled={busy || answered.length === 0} color="ghost">
            Reveal now ({answered.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4" style={EDGE_CLIP}>
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{totalRounds}
            </p>
            <div className="neon-panel p-5 text-center">
              <div className="text-fog text-sm">{round.q}</div>
              <div className="text-4xl font-extrabold mt-1">
                {/* Counts up to the flag. Bank answers are whole numbers; anything
                    else skips the count so rounding can't show a wrong answer. */}
                <RollingNumber
                  from={staged && Number.isInteger(round.answer) ? 0 : round.answer}
                  value={round.answer}
                  ms={REVEAL.flag}
                  format={fmt}
                />{" "}
                {round.unit}
              </div>
            </div>
            <NumberLine answer={round.answer} unit={round.unit} results={phaseData.results ?? []} />
            <Reveal
              kind="rise"
              delayMs={REVEAL.board}
              className="rounded-xl bg-card border border-line p-3 text-sm flex flex-col gap-1.5"
            >
              {sortedResults.map((r) => (
                <div key={r.player_id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0 font-semibold">
                    <PlayerDot id={r.player_id} name={r.name} size="sm" />
                    <span className="truncate">
                      {r.distance != null && r.distance === bestDistance ? "🎯 " : ""}
                      {r.name}
                    </span>
                  </span>
                  <span className="text-fog text-right">
                    {r.guess == null ? "no guess" : `${fmt(r.guess)} (off by ${r.distance!.toLocaleString()})`}
                  </span>
                </div>
              ))}
            </Reveal>
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
        <div style={EDGE_CLIP}>
          <FinalStandings players={players} highlightId={seat.playerId} size="host" staged={staged}>
            <Link href="/ballpark/host" className="tv-hide underline text-fog">
              Play again with a new room
            </Link>
          </FinalStandings>
        </div>
      )}
    </Shell>
  );
}
