"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, QuizRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown, MiniTimer } from "@/app/components/ui";
import { LobbyWait, ResultCard, Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { Confetti } from "@/app/components/Confetti";
import { playerKey } from "@/lib/rooms";
import { useStaged } from "@/lib/motion";
import {
  CHOICE_COLORS,
  CHOICE_LETTERS,
  eliminatedChoices,
  QuizSettings,
  QuizPhaseData,
} from "@/app/quiz/constants";
import { REVEAL, fastestCorrect } from "@/app/quiz/reveal";

export default function QuizPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("quiz", code);
  // Display only: play the reveal and podium on screens that saw them start.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as QuizSettings;
  const answerSeconds = settings.answerSeconds ?? 20;
  const allowChange = !!settings.allowChange;
  const [switching, setSwitching] = useState(false);
  const round = room ? (room.rounds[room.round_idx] as QuizRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as QuizPhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    answerSeconds,
    room?.phase === "question",
  );
  const nextSeconds = settings.nextSeconds ?? 0;
  // Phase in the key so the clock starts when the reveal appears (see host).
  const nextLeft = useCountdown(
    `next-${room?.round_idx}-${room?.phase}`,
    nextSeconds,
    room?.phase === "reveal" && nextSeconds > 0,
  );
  const totalQuestions = room ? Math.min(settings.numQuestions ?? 10, room.rounds.length) : 0;
  const isLast = room ? room.round_idx + 1 >= totalQuestions : false;

  // Reset local pick each new round.
  useEffect(() => {
    setPicked(null);
  }, [room?.round_idx]);

  async function answer(choice: number) {
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

  // Answer changing: delete + reinsert so the server timestamp (and therefore
  // the speed score) re-times from the final pick.
  async function switchTo(i: number) {
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

  if (error)
    return (
      <Shell title="Quiz Rush" icon="⚡">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/quiz/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Quiz Rush" icon="⚡">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/quiz/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const chosen = picked ?? (mySub?.payload.choice as number | undefined) ?? null;
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const iWasFastest = fastestCorrect(phaseData.results)?.player_id === playerId;

  return (
    <Shell title={`Quiz Rush · ${me.name}`} icon="⚡">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "question" && round && (
        <div className="flex flex-col gap-4 flex-1">
          <div className="flex flex-col gap-1.5">
            <p className="text-sm text-fog">
              Question {room.round_idx + 1}/{totalQuestions}
            </p>
            <Countdown left={left} total={answerSeconds} />
          </div>
          <h1 className="text-xl font-extrabold text-center">{round.q}</h1>
          {left > 0 && (chosen == null || allowChange) ? (
            <div className="flex flex-col gap-2">
              {round.choices.map((c, i) => {
                const dead = settings.hints
                  ? eliminatedChoices(room.round_idx, round.answer, left, answerSeconds).includes(i)
                  : false;
                const selected = chosen === i;
                return (
                  <button
                    key={i}
                    onClick={() => (chosen == null ? answer(i) : switchTo(i))}
                    disabled={dead || switching}
                    className={`press flex items-center gap-3 rounded-xl px-3 py-3 text-left text-white ${
                      dead ? "opacity-35 line-through transition-opacity duration-500" : ""
                    } ${selected ? "ring-4 ring-white" : chosen != null ? "opacity-70" : ""}`}
                    style={{ background: CHOICE_COLORS[i] }}
                  >
                    <span className="w-9 h-9 shrink-0 rounded-lg bg-black/25 flex items-center justify-center text-lg font-extrabold">
                      {dead ? "✕" : CHOICE_LETTERS[i]}
                    </span>
                    <span className="font-bold leading-snug">{c}</span>
                  </button>
                );
              })}
              {chosen != null && allowChange && (
                <p className="text-fog text-xs text-center">
                  Tap another answer to change — points re-time from your last pick.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              {chosen != null ? (
                <>
                  <Stamp tone="violet">Locked in</Stamp>
                  <div
                    className="rounded-xl px-6 py-4 font-bold text-white text-xl"
                    style={{ background: CHOICE_COLORS[chosen] }}
                  >
                    {CHOICE_LETTERS[chosen]} · {round.choices[chosen]}
                  </div>
                  <p className="text-fog">Locked in! Waiting for everyone…</p>
                </>
              ) : (
                <p className="text-fog text-xl">⏰ Time&apos;s up!</p>
              )}
            </div>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            {myResult && (
              <ResultCard
                tone={myResult.correct ? "win" : "lose"}
                points={myResult.correct ? myResult.gained : undefined}
                title={
                  myResult.correct
                    ? "Correct!"
                    : myResult.choice == null
                      ? "No answer"
                      : "Wrong answer"
                }
              >
                <div className="text-sm mt-1 opacity-80">
                  Answer: {CHOICE_LETTERS[round.answer]} · {round.choices[round.answer]}
                </div>
              </ResultCard>
            )}
            {/* With the room's Fastest callout, not ahead of it. */}
            {myResult?.correct && iWasFastest && <Confetti pieces={14} delayMs={REVEAL.fastest} />}
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} highlightId={playerId} gains={gains} />
            </Reveal>
            {nextSeconds > 0 ? (
              <MiniTimer
                left={nextLeft}
                total={nextSeconds}
                label={isLast ? "Final standings in" : "Next question in"}
              />
            ) : (
              <p className="text-fog text-sm text-center">Waiting for the host…</p>
            )}
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
      )}
    </Shell>
  );
}
