"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, QuizRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  MiniTimer,
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
import { playerKey } from "@/lib/rooms";
import { addBot, removeBot, humansOf, botsOf, botSkill, botQuizPick, botBlindChoice, botQuizDelayMs } from "@/lib/bots";
import { useBotAnswer } from "@/lib/useBotAnswer";
import { useBotSubmissions } from "@/lib/useBots";

export default function QuizHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("quiz", code);
  const { tv, tvRef } = useSpectator();
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

  const [botErr, setBotErr] = useState<string | null>(null);
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);

  // Bots answer the question themselves — they never see round.answer. With
  // no answer service they pick at random rather than peeking.
  const { ready: botsReady, answer: botAnswer } = useBotAnswer<{ choice: number }>({
    room,
    active: room?.phase === "question" && !!round,
    tvRef,
    ask:
      room?.phase === "question" && round
        ? { kind: "quiz", question: round.q, choices: round.choices }
        : null,
  });

  useBotSubmissions({
    room,
    players,
    roundSubs,
    active: room?.phase === "question" && !!round && botsReady,
    tvRef,
    makePayload: (bot) => ({
      choice: botAnswer
        ? botQuizPick(botAnswer.choice, round!.choices.length, botSkill(bot.id))
        : botBlindChoice(round!.choices.length),
    }),
    delayMs: (bot) => botQuizDelayMs(botSkill(bot.id), answerSeconds),
  });

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

  // The creator can play too (seated from the setup page, like Vibe Check):
  // when this device holds a player for the room, the choice tiles become
  // tappable answer buttons. Never on a TV copy.
  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  const me = players.find((p) => p.id === playerId);
  const canPlay = !!me && !tv;
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const [switching, setSwitching] = useState(false);
  useEffect(() => {
    setPicked(null);
  }, [room?.round_idx]);
  const chosen = picked ?? (mySub?.payload.choice as number | undefined) ?? null;

  async function answerAs(choice: number) {
    if (!room || !playerId || mySub || picked != null || left === 0) return;
    setPicked(choice);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { choice },
    });
    if (e && e.code !== "23505") setPicked(null); // let them retry on real failures
  }

  // Same delete + reinsert as the phone view: the speed score re-times from
  // the final pick.
  async function switchAs(i: number) {
    if (!room || !playerId || !mySub || switching || i === chosen || left === 0) return;
    setSwitching(true);
    await supabase.from("arcade_subs").delete().eq("id", mySub.id);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { choice: i },
    });
    if (!e) setPicked(i);
    setSwitching(false);
  }

  // "getready" no longer exists; a room caught on it mid-deploy would strand
  // with no rule to leave it. Nudge it straight into the question.
  useEffect(() => {
    if (tvRef.current || room?.phase !== "getready") return;
    supabase
      .from("arcade_rooms")
      .update({ phase: "question", phase_data: {} })
      .eq("id", room.id)
      .then(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.id]);

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
  // Time-up now reveals on its own too: a seat that never answers used to
  // stall the round until the host clicked (issue #16). The deadline is
  // anchored to the server-stamped phase_started_at AND the local countdown —
  // both must agree, so a host tab opened mid-round can't cut a round short
  // and a skewed client clock can't fire early. 2s grace lets buzzer-beater
  // submissions land. (TV copies must never do this.)
  const deadlinePassed =
    left === 0 &&
    (!room?.phase_started_at ||
      Date.now() >= new Date(room.phase_started_at).getTime() + (answerSeconds + 2) * 1000);
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase !== "question" || players.length === 0) return;
    if (deadlinePassed) {
      reveal();
    } else if (!settings.allowChange && answeredCount >= players.length) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answeredCount, players.length, room?.phase, left, deadlinePassed]);

  // Background tabs get their timers throttled, so a backgrounded host can go
  // a long time between renders and sit on an overdue reveal. Force a render
  // the moment the tab is fronted or focused again; the effect above then
  // fires immediately instead of waiting for the next throttled tick.
  const [, wake] = useState(0);
  useEffect(() => {
    const onWake = () => wake((n) => n + 1);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  // Auto-advance after the reveal: with a "time between questions" setting,
  // the reveal runs its own little clock and then moves on by itself — the
  // host button becomes a "right now" override. Same two-clock + fire-once
  // + tvRef discipline as the other transitions. 0/absent = manual.
  const nextSeconds = settings.nextSeconds ?? 0;
  // Key includes the phase so the clock starts when the reveal appears, not
  // when the round does.
  const nextLeft = useCountdown(
    `next-${room?.round_idx}-${room?.phase}`,
    nextSeconds,
    room?.phase === "reveal" && nextSeconds > 0,
  );
  const autoNextRef = useRef<number | null>(null);
  const nextDeadlinePassed =
    nextSeconds > 0 &&
    nextLeft === 0 &&
    (!room?.phase_started_at ||
      Date.now() >= new Date(room.phase_started_at).getTime() + nextSeconds * 1000);
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase !== "reveal" || !nextDeadlinePassed) return;
    if (autoNextRef.current === room.round_idx) return;
    autoNextRef.current = room.round_idx;
    next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.round_idx, nextDeadlinePassed]);

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
          <CodeBadge code={room.code} game="quiz" />
          <p className="text-center text-fog text-sm">
            Players join at this site → Quiz Rush → Join, with the code.
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
            disabled={busy || players.length < 1 || humansOf(players).length < 1}
          >
            {humansOf(players).length < 1
              ? "Waiting for a human…"
              : `Start (${totalQuestions} questions)`}
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
              const tile = `rounded-xl p-4 font-bold text-white text-center ${
                dead ? "opacity-30 line-through" : ""
              }`;
              if (!canPlay)
                return (
                  <div key={i} className={tile} style={{ background: CHOICE_COLORS[i] }}>
                    {CHOICE_LETTERS[i]} · {c}
                  </div>
                );
              const selected = chosen === i;
              return (
                <button
                  key={i}
                  // Blur so the focus outline can't linger into the next
                  // question and read as a selection.
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (chosen == null) answerAs(i);
                    else switchAs(i);
                  }}
                  disabled={
                    dead ||
                    switching ||
                    left === 0 ||
                    (chosen != null && !settings.allowChange)
                  }
                  className={`${tile} active:scale-[0.98] transition ${
                    selected
                      ? "ring-4 ring-white"
                      : chosen != null
                        ? "opacity-60"
                        : ""
                  }`}
                  style={{ background: CHOICE_COLORS[i] }}
                >
                  {CHOICE_LETTERS[i]} · {c}
                </button>
              );
            })}
          </div>
          {canPlay && left > 0 && (
            <p className="text-fog text-xs text-center">
              {chosen == null
                ? `Playing as ${me!.name} — tap your answer.`
                : settings.allowChange
                  ? "Tap another answer to change — points re-time from your last pick."
                  : `Locked in as ${me!.name}. Waiting for everyone…`}
            </p>
          )}
          {botsReady && !botAnswer && botsOf(players).length > 0 && (
            <p className="text-lose text-center text-xs">
              Bots are answering at random — the answer service is unavailable.
            </p>
          )}
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
          <Leaderboard players={players} gains={gains} highlightId={playerId} />
          {nextSeconds > 0 && (
            <MiniTimer
              left={nextLeft}
              total={nextSeconds}
              label={
                room.round_idx + 1 >= totalQuestions
                  ? "Final standings in"
                  : "Next question in"
              }
            />
          )}
          <BigBtn onClick={next} disabled={busy} color={nextSeconds > 0 ? "ghost" : "glow"}>
            {room.round_idx + 1 >= totalQuestions
              ? nextSeconds > 0
                ? "Finish now"
                : "Finish game"
              : nextSeconds > 0
                ? "Next now"
                : "Next question"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
          <Link href="/quiz/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
