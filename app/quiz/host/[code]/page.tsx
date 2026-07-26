"use client";

import { useRef, useState, use, useEffect } from "react";
import { supabase, QuizRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
} from "@/app/components/ui";
import {
  CHOICE_COLORS,
  CHOICE_LETTERS,
  pointsForElapsed,
  eliminatedChoices,
  QuizSettings,
  QuizPhaseData,
  QuizResult,
} from "@/app/quiz/constants";

export default function QuizHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("quiz", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as QuizSettings;
  const answerSeconds = settings.answerSeconds ?? 20;
  const totalQuestions = Math.min(settings.numQuestions ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as QuizRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as QuizPhaseData;
  // Unique players (answer-changing can briefly leave two rows in local state).
  const answeredCount = new Set(
    subs.filter((s) => s.round_idx === room?.round_idx).map((s) => s.player_id),
  ).size;

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    answerSeconds,
    room?.phase === "question",
  );

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "question", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  async function reveal() {
    if (!room || !round || room.phase !== "question") return;
    if (revealingRef.current === room.round_idx) return; // fire once per round
    revealingRef.current = room.round_idx;
    setBusy(true);

    // Server-timestamped submissions, in arrival order = speed ranking.
    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx)
      .order("created_at", { ascending: true });

    const rows = (subRows ?? []) as {
      player_id: string;
      payload: { choice?: number };
      created_at: string;
    }[];
    // Question start was stamped server-side by the DB trigger.
    const { data: fresh } = await supabase
      .from("arcade_rooms")
      .select("phase_started_at")
      .eq("id", room.id)
      .single();
    const startMs = fresh?.phase_started_at
      ? new Date(fresh.phase_started_at as string).getTime()
      : null;
    const counts = [0, 0, 0, 0];
    const results: QuizResult[] = players.map((p) => {
      const sub = rows.find((r) => r.player_id === p.id);
      const choice = sub?.payload.choice ?? null;
      if (choice != null && choice >= 0 && choice < 4) counts[choice]++;
      return { player_id: p.id, name: p.name, gained: 0, correct: false, choice };
    });
    for (const r of rows) {
      const res = results.find((x) => x.player_id === r.player_id);
      if (!res || r.payload.choice !== round.answer) continue;
      res.correct = true;
      const elapsedMs =
        startMs != null
          ? Math.max(0, new Date(r.created_at).getTime() - startMs)
          : answerSeconds * 500; // fallback: score as a half-time answer
      res.gained = pointsForElapsed(elapsedMs, answerSeconds);
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
      .update({ phase: "reveal", phase_data: { counts, results } })
      .eq("id", room.id);
    setBusy(false);
  }

  // Auto-reveal when everyone has answered — unless answer-changing is on,
  // in which case the round runs the full clock so people can switch.
  // (TV copies must never do this.)
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase !== "question" || players.length === 0) return;
    if (settings.allowChange) {
      if (left === 0) reveal();
    } else if (answeredCount >= players.length) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, players.length, room?.phase, left]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalQuestions;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "question", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Quiz Rush" icon="⚡"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Quiz Rush" icon="⚡"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title="Quiz Rush · host" icon="⚡">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Quiz Rush → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 1}>
            {players.length < 1 ? "Waiting for players…" : `Start (${totalQuestions} questions)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "question" && round && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Question {room.round_idx + 1}/{totalQuestions} · {round.cat}
            </span>
            <span>
              {answeredCount}/{players.length} answered
            </span>
          </div>
          <Countdown left={left} total={answerSeconds} />
          <h1 className="text-2xl font-extrabold text-center py-4">{round.q}</h1>
          <div className="grid grid-cols-2 gap-2">
            {round.choices.map((c, i) => {
              const dead = settings.hints
                ? eliminatedChoices(room.round_idx, round.answer, left, answerSeconds).includes(i)
                : false;
              return (
                <div
                  key={i}
                  className={`rounded-xl p-4 font-bold text-white text-center ${
                    dead ? "opacity-30 line-through" : ""
                  }`}
                  style={{ background: CHOICE_COLORS[i] }}
                >
                  {CHOICE_LETTERS[i]} · {c}
                </div>
              );
            })}
          </div>
          <BigBtn onClick={reveal} disabled={busy} color={left === 0 ? "glow" : "ghost"}>
            {left === 0 ? "Time! Reveal answers" : "Reveal early"}
          </BigBtn>
          {(settings.hints || settings.allowChange) && (
            <p className="text-fog text-xs text-center">
              {settings.hints && "Hints strike wrong answers at ½ and ¼ time. "}
              {settings.allowChange && "Players can change answers until time runs out."}
            </p>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Question {room.round_idx + 1}/{totalQuestions}
          </p>
          <h1 className="text-xl font-extrabold text-center">{round.q}</h1>
          <div className="grid grid-cols-2 gap-2">
            {round.choices.map((c, i) => (
              <div
                key={i}
                className={`rounded-xl p-4 font-bold text-white text-center ${
                  i === round.answer ? "ring-4 ring-win" : "opacity-40"
                }`}
                style={{ background: CHOICE_COLORS[i] }}
              >
                {CHOICE_LETTERS[i]} · {c}
                <span className="block text-sm font-normal">
                  {(phaseData.counts ?? [])[i] ?? 0} votes
                </span>
              </div>
            ))}
          </div>
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalQuestions ? "Finish game" : "Next question"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <a href="/quiz/host" className="underline text-fog">
            Play again with a new room
          </a>
        </div>
      )}
    </Shell>
  );
}
