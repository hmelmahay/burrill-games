"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { supabase, ScatterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { POINTS_PER_ANSWER, ScatterPhaseData } from "@/app/scatter/constants";

export default function ScatterPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("scatter", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<string[]>(["", "", "", "", ""]);
  const [sent, setSent] = useState(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const sentRef = useRef(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setAnswers(["", "", "", "", ""]);
    setSent(false);
    sentRef.current = false;
  }, [room?.round_idx]);

  const settings = (room?.settings ?? {}) as { roundSeconds?: number };
  const roundSeconds = settings.roundSeconds ?? 60;
  const round = room ? (room.rounds[room.round_idx] as ScatterRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ScatterPhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    roundSeconds,
    room?.phase === "write",
  );

  async function handIn() {
    if (!room || !playerId || sentRef.current || mySub) return;
    sentRef.current = true;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { answers: answersRef.current.map((a) => a.trim()) },
    });
    if (e && e.code !== "23505") {
      sentRef.current = false;
      setSent(false);
    }
  }

  // Auto-hand-in when the clock hits zero (or judging starts before we sent).
  useEffect(() => {
    if (room?.phase === "write" && left === 0) handIn();
    if (room?.phase === "judge" && !sent && !mySub) handIn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room?.phase]);

  if (error)
    return (
      <Shell title="Scatter Sprint" icon="📝">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/scatter/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Scatter Sprint" icon="📝">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/scatter/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const locked = sent || !!mySub;

  return (
    <Shell title={`Scatter Sprint · ${me.name}`} icon="📝">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "write" && round && (
        <div className="flex flex-col gap-3">
          <Countdown left={left} total={roundSeconds} />
          <div className="rounded-xl border-2 border-glow bg-card p-3 text-center">
            <span className="text-fog text-sm mr-2">Everything starts with</span>
            <span className="text-4xl font-extrabold text-glow align-middle">
              {round.letter}
            </span>
          </div>
          {!locked ? (
            <>
              {round.categories.map((cat, i) => (
                <label key={i} className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">{cat}</span>
                  <input
                    value={answers[i]}
                    onChange={(e) =>
                      setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={40}
                    className="rounded-lg border border-line bg-card px-3 py-2.5"
                    placeholder={`${round.letter}…`}
                  />
                </label>
              ))}
              <button
                onClick={handIn}
                className="rounded-xl bg-glow text-[#1a1000] py-3.5 font-bold text-lg mt-1"
              >
                Hand in early
              </button>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
              <p className="text-3xl">📬</p>
              <p className="font-bold text-xl">Handed in!</p>
              <p className="text-fog">Waiting for the timer…</p>
            </div>
          )}
        </div>
      )}

      {room.phase === "judge" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">⚖️</p>
          <h1 className="text-xl font-extrabold">Pencils down!</h1>
          <p className="text-fog text-center">
            The host is judging answers. Defend yours out loud.
          </p>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <ul className="text-sm mt-2 text-left">
                {myResult.cells.map((cell, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className={cell.s === "ok" ? "" : "line-through opacity-70"}>
                      {round.categories[i]}: {cell.a || "—"}
                    </span>
                    <span className="font-semibold">
                      {cell.s === "ok" && `+${POINTS_PER_ANSWER}`}
                      {cell.s === "dupe" && "dupe"}
                      {cell.s === "invalid" && "wrong letter"}
                      {cell.s === "rejected" && "rejected"}
                    </span>
                  </li>
                ))}
              </ul>
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
