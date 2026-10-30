"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { useStaged } from "@/lib/motion";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips, HostSeatCard } from "@/app/components/ui";
import { Dots, LockInRow, Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { PlayerDot } from "@/app/components/brand";
import { FinalStandings } from "@/app/components/FinalStandings";
import { shuffle } from "@/lib/rooms";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/twotruths/PlayerPanel";
import { Verdicts } from "@/app/twotruths/Verdicts";
import { REVEAL } from "@/app/twotruths/reveal";
import {
  VOTER_POINTS,
  AUTHOR_POINTS_PER_FOOL,
  TTRound,
  TTResult,
  TTPhaseData,
} from "@/app/twotruths/constants";

export default function TTHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("twotruths", code);
  const { tvRef } = useSpectator();
  const seat = useHostSeat("twotruths", code, players, refresh, playersLoaded);
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);
  // Play the reveal and the podium only for a screen that saw the phase start.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const settings = (room?.settings ?? {}) as { cycles?: number };
  const rounds = (room?.rounds ?? []) as TTRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as TTPhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const authorSub = roundSubs.find((s) => s.player_id === round?.author_id);
  const votes = roundSubs.filter((s) => s.player_id !== round?.author_id);
  const voterCount = Math.max(0, players.length - 1);

  async function startGame() {
    if (!room) return;
    setBusy(true);
    const cycles = settings.cycles ?? 1;
    const order: TTRound[] = [];
    for (let c = 0; c < cycles; c++) {
      order.push(
        ...shuffle(players).map((p) => ({ author_id: p.id, author_name: p.name })),
      );
    }
    await supabase
      .from("arcade_rooms")
      .update({
        status: "playing",
        phase: "write",
        round_idx: 0,
        rounds: order,
        phase_data: {},
      })
      .eq("id", room.id);
    setBusy(false);
  }

  // Author handed in their statements → publish them (lie withheld) and open voting.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "write" || !authorSub) return;
    const key = `vote-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    const statements = (authorSub.payload as { statements?: string[] }).statements ?? [];
    // Only for this round: if a Skip already moved the room on, this must not
    // drop the next round into voting with no statements.
    supabase
      .from("arcade_rooms")
      .update({ phase: "vote", phase_data: { statements } })
      .eq("id", room.id)
      .eq("round_idx", room.round_idx)
      .eq("phase", "write")
      .then(({ error: e }) => {
        if (e) console.error("open voting failed:", e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorSub?.id, room?.phase]);

  async function reveal() {
    if (!room || !round || room.phase !== "vote" || !authorSub) return;
    const key = `reveal-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    setBusy(true);

    const lie = (authorSub.payload as { lie?: number }).lie ?? 0;
    let fooled = 0;
    const results: TTResult[] = players.map((p) => {
      if (p.id === round.author_id) {
        return { player_id: p.id, name: p.name, gained: 0, vote: null, correct: false };
      }
      const v = votes.find((s) => s.player_id === p.id);
      const vote = (v?.payload as { vote?: number } | undefined)?.vote ?? null;
      const correct = vote === lie;
      if (v && !correct) fooled++;
      return {
        player_id: p.id,
        name: p.name,
        gained: correct ? VOTER_POINTS : 0,
        vote,
        correct,
      };
    });
    const authorResult = results.find((r) => r.player_id === round.author_id);
    if (authorResult) authorResult.gained = fooled * AUTHOR_POINTS_PER_FOOL;

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
      .update({
        phase: "reveal",
        phase_data: { statements: phaseData.statements, lie, results },
      })
      .eq("id", room.id);
    setBusy(false);
  }

  // Auto-reveal once every voter has voted.
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "vote" && voterCount > 0 && votes.length >= voterCount) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votes.length, voterCount, room?.phase]);

  async function skipAuthor() {
    if (!room) return;
    await next();
  }

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= rounds.length;
    advancingRef.current = null;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "write", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Two Truths & a Lie" icon="🤥"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Two Truths & a Lie" icon="🤥"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const hostIsAuthor = seat.canPlay && round?.author_id === seat.playerId;
  const hostVotes = seat.canPlay && !!seat.playerId && !hostIsAuthor;
  // Voters the lie fooled (the author's "Fooled n" stamp on the reveal).
  const fooled = (phaseData.results ?? []).filter((r) => r.vote != null && !r.correct).length;

  return (
    <Shell
      title="Two Truths & a Lie · host"
      icon="🤥"
      attractKey={room.phase === "lobby" ? players.length : undefined}
    >
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Two Truths &amp; a Lie → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 3} attention={players.length >= 3}>
            {players.length < 3
              ? "Need at least 3 players…"
              : `Start (${players.length * (settings.cycles ?? 1)} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "write" && round && hostIsAuthor && seat.playerId && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
            <PlayerPanel room={room} subs={subs} playerId={seat.playerId} conceal />
          </div>
          <BigBtn onClick={skipAuthor} disabled={busy} color="ghost">
            Skip my turn
          </BigBtn>
        </div>
      )}

      {room.phase === "write" && round && !hostIsAuthor && (
        <div className="flex flex-col gap-4 items-center py-8">
          <p className="text-sm text-fog">
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <p className="text-4xl">✍️</p>
          <h1 className="text-2xl font-extrabold text-center">
            {round.author_name} is writing
            <Dots />
          </h1>
          <p className="text-fog text-center">
            Two truths and one lie, coming up. Everyone else: stretch your lie-detector.
          </p>
          <BigBtn onClick={skipAuthor} disabled={busy} color="ghost">
            Skip {round.author_name}
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length} · about {round.author_name}
          </p>
          {hostVotes && seat.playerId ? (
            <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
              <PlayerPanel room={room} subs={subs} playerId={seat.playerId} conceal />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-extrabold text-center">Which one is the lie?</h1>
              <div className="flex flex-col gap-2">
                {(phaseData.statements ?? []).map((s, i) => (
                  <div key={i} className="rounded-xl bg-card border border-line p-4 font-semibold">
                    {i + 1}. {s}
                  </div>
                ))}
              </div>
            </>
          )}
          <LockInRow
            players={players.filter((p) => p.id !== round.author_id)}
            doneIds={votes.map((v) => v.player_id)}
            label="votes in"
          />
          <BigBtn onClick={reveal} disabled={busy || votes.length === 0} color="ghost">
            Reveal now ({votes.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{rounds.length} · {round.author_name}&apos;s lie revealed
            </p>
            <Verdicts statements={phaseData.statements ?? []} lie={phaseData.lie} results={phaseData.results ?? []} />
            <Reveal kind="fade" delayMs={REVEAL.fooled} className="flex items-center justify-center gap-3">
              <PlayerDot id={round.author_id} name={round.author_name} />
              <span className="min-w-0 truncate font-bold">{round.author_name}</span>
              <Stamp tone="violet">Fooled {fooled}</Stamp>
            </Reveal>
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} gains={gains} highlightId={seat.playerId} />
            </Reveal>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= rounds.length ? "Finish game" : "Next round"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={seat.playerId} size="host" staged={staged}>
          <Link href="/twotruths/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}
