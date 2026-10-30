"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, MajorityRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips, HostSeatCard } from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { PlayerDot } from "@/app/components/brand";
import { stagger } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { addBot, removeBot, humansOf, botsOf, botSkill, crowdBias, botBinaryVote, botPredict } from "@/lib/bots";
import { useBotSubmissions } from "@/lib/useBots";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/majority/PlayerPanel";
import { SplitBar } from "@/app/majority/SplitBar";
import { REVEAL } from "@/app/majority/reveal";
import {
  PREDICT_POINTS,
  TIE_POINTS,
  MajorityPhaseData,
  MajorityResult,
} from "@/app/majority/constants";

export default function MajorityHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("majority", code);
  const { tvRef } = useSpectator();
  const seat = useHostSeat("majority", code, players, refresh, playersLoaded);
  // Visual only: should this screen play the staged reveal for the current phase?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number };
  const totalRounds = Math.min(settings.numRounds ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as MajorityRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as MajorityPhaseData;
  const answered = subs.filter((s) => s.round_idx === room?.round_idx);
  const [botErr, setBotErr] = useState<string | null>(null);

  // One shared leaning per prompt so bot votes cluster like real taste —
  // otherwise predicting the room would be a coin flip.
  const bias = round ? crowdBias(`${round.a}|${round.b}`) : 0.5;
  useBotSubmissions({
    room,
    players,
    roundSubs: answered,
    active: room?.phase === "vote" && !!round,
    tvRef,
    makePayload: (bot) => ({
      vote: botBinaryVote(bias),
      pred: botPredict(bias, botSkill(bot.id)),
    }),
  });

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
    const rows = (subRows ?? []) as {
      player_id: string;
      payload: { vote?: "a" | "b"; pred?: "a" | "b" };
    }[];

    let aCount = 0;
    let bCount = 0;
    rows.forEach((r) => {
      if (r.payload.vote === "a") aCount++;
      if (r.payload.vote === "b") bCount++;
    });
    const majority: "a" | "b" | "tie" =
      aCount === bCount ? "tie" : aCount > bCount ? "a" : "b";

    const results: MajorityResult[] = players.map((p) => {
      const sub = rows.find((r) => r.player_id === p.id);
      const vote = sub?.payload.vote ?? null;
      const pred = sub?.payload.pred ?? null;
      let gained = 0;
      if (sub) {
        if (majority === "tie") gained = TIE_POINTS;
        else if (pred === majority) gained = PREDICT_POINTS;
      }
      return { player_id: p.id, name: p.name, gained, vote, pred };
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
      .update({ phase: "reveal", phase_data: { aCount, bCount, majority, results } })
      .eq("id", room.id);
    setBusy(false);
  }

  // Auto-reveal when everyone has voted. (TV copies must never do this.)
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

  if (error) return <Shell title="Majority Rules" icon="🐑"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Majority Rules" icon="🐑"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const totalVotes = (phaseData.aCount ?? 0) + (phaseData.bCount ?? 0);
  const aPct = totalVotes ? Math.round(((phaseData.aCount ?? 0) / totalVotes) * 100) : 0;
  const bPct = totalVotes ? 100 - aPct : 0;
  const canStart = players.length >= 2 && humansOf(players).length >= 1;
  const votes = (n: number) => `${n} vote${n === 1 ? "" : "s"}`;
  const votersFor = (side: "a" | "b") => (phaseData.results ?? []).filter((r) => r.vote === side);
  // Dots under each side of the split bar: who voted which way.
  const voterDots = (side: "a" | "b") => {
    const list = votersFor(side);
    return (
      <div className={`flex min-w-0 flex-1 flex-wrap gap-1 ${side === "b" ? "justify-end" : ""}`}>
        {list.map((r, i) => (
          <Reveal
            key={r.player_id}
            as="span"
            kind="pop"
            delayMs={REVEAL.voters + stagger(i, list.length, 50, 500)}
            className="inline-flex"
          >
            <PlayerDot id={r.player_id} name={r.name} size="lg" />
          </Reveal>
        ))}
        {list.length > 0 && (
          <span className="sr-only">
            Voted {side === "a" ? round?.a : round?.b}: {list.map((r) => r.name).join(", ")}
          </span>
        )}
      </div>
    );
  };

  return (
    <Shell
      title="Majority Rules · host"
      icon="🐑"
      attractKey={room.phase === "lobby" ? players.length : undefined}
    >
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Majority Rules → Join, with the code.
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
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 2 || humansOf(players).length < 1}
            attention={canStart}
          >
            {players.length < 2
              ? "Need at least 2 players (bots count)…"
              : humansOf(players).length < 1
                ? "Need at least 1 human…"
                : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "vote" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{totalRounds}
            </p>
            {seat.canPlay && seat.playerId ? (
              <div className="rounded-2xl border-2 border-violet bg-card/60 p-4">
                <PlayerPanel room={room} subs={subs} playerId={seat.playerId} conceal />
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-extrabold text-center">Which one, room?</h1>
                {/* Majority isn't timed, so the cards can take a beat to land. */}
                <div className="grid grid-cols-1 gap-3">
                  <Reveal kind="rise" className="rounded-xl bg-glow text-[#1a1000] p-5 text-center font-bold text-xl">
                    {round.a}
                  </Reveal>
                  <div className="text-center">
                    <Stamp tone="gold" delayMs={240}>
                      VS
                    </Stamp>
                  </div>
                  <Reveal
                    kind="rise"
                    delayMs={120}
                    className="rounded-xl bg-violet text-white p-5 text-center font-bold text-xl"
                  >
                    {round.b}
                  </Reveal>
                </div>
                <p className="text-fog text-sm text-center">
                  Everyone votes on their phone and predicts the majority.
                </p>
              </>
            )}
            <LockInRow players={players} doneIds={answered.map((s) => s.player_id)} label="voted" />
            <BigBtn onClick={reveal} disabled={busy || answered.length === 0} color="ghost">
              Reveal now ({answered.length} in)
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{totalRounds}
            </p>
            <div className="neon-panel p-4 flex flex-col gap-3">
              <div className="flex justify-between gap-3 font-bold">
                <span className="min-w-0 break-words text-glow">{round.a}</span>
                <span className="min-w-0 break-words text-right text-[#a78bfa]">{round.b}</span>
              </div>
              <SplitBar aCount={phaseData.aCount ?? 0} bCount={phaseData.bCount ?? 0} />
              <Reveal kind="fade" delayMs={REVEAL.verdict} className="flex justify-between gap-3 text-sm text-fog">
                <span>
                  {votes(phaseData.aCount ?? 0)} · {aPct}%
                </span>
                <span className="text-right">
                  {votes(phaseData.bCount ?? 0)} · {bPct}%
                </span>
              </Reveal>
              <div className="flex justify-between gap-3">
                {voterDots("a")}
                {voterDots("b")}
              </div>
              <div className="flex flex-col items-center gap-1 pt-1">
                <Stamp
                  size="lg"
                  tone={phaseData.majority === "tie" ? "gold" : phaseData.majority === "a" ? "glow" : "violet"}
                  delayMs={REVEAL.verdict}
                  className="max-w-full whitespace-normal text-center"
                >
                  {phaseData.majority === "tie"
                    ? "Dead tie"
                    : `Majority: ${phaseData.majority === "a" ? round.a : round.b}`}
                </Stamp>
                {phaseData.majority === "tie" && (
                  <Reveal as="p" kind="fade" delayMs={REVEAL.verdict} className="text-fog text-sm">
                    Everybody who voted scores.
                  </Reveal>
                )}
              </div>
            </div>
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
          <Link href="/majority/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}
