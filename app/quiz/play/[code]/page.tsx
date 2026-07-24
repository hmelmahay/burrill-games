"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, QuizRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { CHOICE_COLORS, CHOICE_SHAPES, QuizPhaseData } from "@/app/quiz/constants";

export default function QuizPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("quiz", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as { numQuestions?: number; answerSeconds?: number };
  const answerSeconds = settings.answerSeconds ?? 20;
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

  return (
    <Shell title={`Quiz Rush · ${me.name}`} icon="⚡">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "question" && round && (
        <div className="flex flex-col gap-4 flex-1">
          <Countdown left={left} total={answerSeconds} />
          <h1 className="text-xl font-extrabold text-center">{round.q}</h1>
          {chosen == null && left > 0 ? (
            <div className="grid grid-cols-2 gap-3 flex-1">
              {round.choices.map((c, i) => (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  className="rounded-xl p-4 font-bold text-white text-lg active:scale-95 transition"
                  style={{ background: CHOICE_COLORS[i] }}
                >
                  {CHOICE_SHAPES[i]}
                  <span className="block text-base">{c}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              {chosen != null ? (
                <>
                  <div
                    className="rounded-xl px-6 py-4 font-bold text-white text-xl"
                    style={{ background: CHOICE_COLORS[chosen] }}
                  >
                    {CHOICE_SHAPES[chosen]} {round.choices[chosen]}
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
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-6 text-center pop-in ${
                myResult.correct ? "bg-win text-[#03180b]" : "bg-lose text-white"
              }`}
            >
              <div className="text-3xl font-extrabold">
                {myResult.correct ? `+${myResult.gained}` : "✗"}
              </div>
              <div className="font-semibold">
                {myResult.correct
                  ? "Correct!"
                  : myResult.choice == null
                    ? "No answer"
                    : "Wrong answer"}
              </div>
              <div className="text-sm mt-1 opacity-80">
                Answer: {CHOICE_SHAPES[round.answer]} {round.choices[round.answer]}
              </div>
            </div>
          )}
          <Leaderboard players={players} highlightId={playerId} />
          <p className="text-fog text-sm text-center">Waiting for the host…</p>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-4 items-center">
          <h1 className="text-3xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
        </div>
      )}
    </Shell>
  );
}
