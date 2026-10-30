"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, EmojiRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
  HostSeatCard,
} from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope } from "@/app/components/fx";
import { PlayerDot } from "@/app/components/brand";
import { FinalStandings } from "@/app/components/FinalStandings";
import { FX, stagger } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { guessMatches } from "@/lib/matching";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/emoji/PlayerPanel";
import { NowShowing } from "@/app/emoji/NowShowing";
import { REVEAL } from "@/app/emoji/reveal";
import {
  BASE_POINTS,
  SPEED_BONUS,
  LATE_BONUS,
  EmojiPhaseData,
  EmojiResult,
} from "@/app/emoji/constants";

export default function EmojiHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("emoji", code);
  const { tvRef } = useSpectator();
  const seat = useHostSeat("emoji", code, players, refresh, playersLoaded);
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number; guessSeconds?: number };
  const guessSeconds = settings.guessSeconds ?? 30;
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as EmojiRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as EmojiPhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    guessSeconds,
    room?.phase === "guess",
  );
  // Play the reveal and podium only for a screen that saw them start.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

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
      .eq("round_idx", room.round_idx)
      .order("created_at", { ascending: true });
    const rows = (subRows ?? []) as { player_id: string; payload: { guess?: string } }[];

    let rank = 0;
    const results: EmojiResult[] = players.map((p) => ({
      player_id: p.id,
      name: p.name,
      gained: 0,
      correct: false,
      guess: rows.find((r) => r.player_id === p.id)?.payload.guess ?? null,
    }));
    for (const r of rows) {
      const res = results.find((x) => x.player_id === r.player_id);
      if (!res || !r.payload.guess) continue;
      if (guessMatches(r.payload.guess, round.answer, round.alts)) {
        res.correct = true;
        res.gained = BASE_POINTS + (SPEED_BONUS[rank] ?? LATE_BONUS);
        rank++;
      }
    }

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

  if (error) return <Shell title="Emoji Cinema" icon="🎬"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Emoji Cinema" icon="🎬"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell
      title="Emoji Cinema · host"
      icon="🎬"
      attractKey={room.phase === "lobby" ? players.length : undefined}
    >
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Emoji Cinema → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 1}
            attention={players.length >= 1}
          >
            {players.length < 1 ? "Waiting for players…" : `Start (${totalRounds} puzzles)`}
          </BigBtn>
        </div>
      )}

      {/* Nothing here waits: a seated host guesses on this screen for speed points. */}
      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Puzzle {room.round_idx + 1}/{totalRounds}
          </p>
          <Countdown left={left} total={guessSeconds} />
          <NowShowing emoji={round.emoji} kind={round.kind} />
          {seat.canPlay && seat.playerId ? (
            <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
              <PlayerPanel room={room} subs={subs} playerId={seat.playerId} left={left} conceal />
            </div>
          ) : (
            <p className="text-fog text-center text-sm">
              It&apos;s a {round.kind.toLowerCase()} — type your guess on your phone!
            </p>
          )}
          <LockInRow players={players} doneIds={answered.map((s) => s.player_id)} label="guessed" />
          <BigBtn
            onClick={reveal}
            disabled={busy}
            color={left === 0 ? "glow" : "ghost"}
            attention={left === 0}
          >
            {left === 0 ? "Time! Reveal answer" : "Reveal early"}
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Puzzle {room.round_idx + 1}/{totalRounds}
            </p>
            <NowShowing emoji={round.emoji} kind={round.kind} answer={round.answer} />
            <GuessList results={phaseData.results ?? []} />
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} gains={gains} highlightId={seat.playerId} />
            </Reveal>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next puzzle"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={seat.playerId} size="host" staged={staged}>
          <Link href="/emoji/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}

// Everyone's guess, most points first, so right answers lead. The first five
// solves score 750 down to 550, so the three fastest get 1ST, 2ND and 3RD;
// later solves all score 525 and get no badge. Rows rise in from REVEAL.list,
// 60ms apart.
function GuessList({ results }: { results: EmojiResult[] }) {
  const sorted = [...results].sort((a, b) => b.gained - a.gained);
  const solvers = sorted.filter((r) => r.correct).map((r) => r.player_id);
  return (
    <ol className="rounded-xl bg-card border border-line p-3 text-sm flex flex-col gap-1.5">
      {sorted.map((r, i) => {
        const place = solvers.indexOf(r.player_id) + 1;
        return (
          <Reveal
            as="li"
            key={r.player_id}
            kind="rise"
            delayMs={REVEAL.list + stagger(i, sorted.length, FX.stagger, 600)}
            className="flex items-center gap-2"
          >
            <span className="w-11 shrink-0 text-center">
              {place >= 1 && place <= 3 && (
                <span className={`rank-badge rank-${place}`}>{["1ST", "2ND", "3RD"][place - 1]}</span>
              )}
            </span>
            <PlayerDot id={r.player_id} name={r.name} size="sm" />
            <span className="font-semibold truncate max-w-[45%]">{r.name}</span>
            <span className={`flex-1 truncate text-right ${r.correct ? "text-win" : "text-fog"}`}>
              {r.guess ?? "—"}
              {r.correct ? " ✓" : ""}
            </span>
          </Reveal>
        );
      })}
      {sorted.length === 0 && <li className="text-fog">No guesses this round.</li>}
    </ol>
  );
}
