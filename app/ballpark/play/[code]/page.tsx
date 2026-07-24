"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, BallparkRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { BallparkPhaseData } from "@/app/ballpark/constants";

export default function BallparkPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("ballpark", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setGuess("");
    setSent(false);
  }, [room?.round_idx]);

  const round = room ? (room.rounds[room.round_idx] as BallparkRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as BallparkPhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );

  async function submit() {
    const num = Number(guess.replace(/[,\s]/g, ""));
    if (!room || !playerId || mySub || sent || !guess.trim() || !isFinite(num)) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { guess: num },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (error)
    return (
      <Shell title="Ballpark" icon="🎯">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/ballpark/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Ballpark" icon="🎯">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/ballpark/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const locked = sent || !!mySub;

  return (
    <Shell title={`Ballpark · ${me.name}`} icon="🎯">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-violet p-5 text-center">
            <h1 className="text-xl font-extrabold">{round.q}</h1>
          </div>
          {!locked ? (
            <>
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value.replace(/[^0-9.,-]/g, ""))}
                placeholder="Your number…"
                inputMode="decimal"
                autoComplete="off"
                className="rounded-xl border-2 border-glow bg-card px-4 py-4 text-2xl text-center font-mono"
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
              <button
                onClick={submit}
                disabled={!guess.trim()}
                className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
              >
                Lock it in
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="font-bold text-2xl font-mono">
                🔒 {mySub ? Number(mySub.payload.guess).toLocaleString() : guess}
              </p>
              <p className="text-fog">Waiting for everyone…</p>
            </div>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-win p-5 text-center">
            <div className="text-fog text-sm">{round.q}</div>
            <div className="text-3xl font-extrabold mt-1">
              {round.answer.toLocaleString()} {round.unit}
            </div>
          </div>
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained >= 500 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm mt-1">
                {myResult.guess == null
                  ? "No guess in time"
                  : myResult.distance === 0
                    ? "DEAD ON. Are you psychic?"
                    : `You said ${myResult.guess.toLocaleString()} — off by ${myResult.distance!.toLocaleString()}`}
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
