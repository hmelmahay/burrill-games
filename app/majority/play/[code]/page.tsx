"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase, MajorityRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { MajorityPhaseData } from "@/app/majority/constants";

export default function MajorityPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("majority", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [vote, setVote] = useState<"a" | "b" | null>(null);
  const [pred, setPred] = useState<"a" | "b" | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setVote(null);
    setPred(null);
    setSent(false);
  }, [room?.round_idx]);

  const round = room ? (room.rounds[room.round_idx] as MajorityRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as MajorityPhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );

  async function submit(v: "a" | "b", p: "a" | "b") {
    if (!room || !playerId || mySub || sent) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { vote: v, pred: p },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (error)
    return (
      <Shell title="Majority Rules" icon="🐑">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/majority/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Majority Rules" icon="🐑">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/majority/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const locked = sent || !!mySub;

  return (
    <Shell title={`Majority Rules · ${me.name}`} icon="🐑">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "vote" && round && !locked && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="font-bold text-center text-lg">1 · Your pick?</h2>
            <button
              onClick={() => setVote("a")}
              className={`rounded-xl p-4 font-bold text-lg bg-glow text-[#1a1000] ${
                vote === "a" ? "ring-4 ring-white" : vote ? "opacity-40" : ""
              }`}
            >
              {round.a}
            </button>
            <button
              onClick={() => setVote("b")}
              className={`rounded-xl p-4 font-bold text-lg bg-violet text-white ${
                vote === "b" ? "ring-4 ring-white" : vote ? "opacity-40" : ""
              }`}
            >
              {round.b}
            </button>
          </div>
          {vote && (
            <div className="flex flex-col gap-2 pop-in">
              <h2 className="font-bold text-center text-lg">
                2 · What will the <span className="underline">majority</span> pick?
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPred("a");
                    submit(vote, "a");
                  }}
                  className="rounded-xl p-4 font-bold bg-glow/80 text-[#1a1000]"
                >
                  {round.a}
                </button>
                <button
                  onClick={() => {
                    setPred("b");
                    submit(vote, "b");
                  }}
                  className="rounded-xl p-4 font-bold bg-violet/80 text-white"
                >
                  {round.b}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {room.phase === "vote" && round && locked && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🔒</p>
          <p className="font-bold text-xl">Locked in!</p>
          <p className="text-fog text-sm">
            You picked {vote === "a" ? round.a : vote === "b" ? round.b : "…"} and predicted the
            room goes {pred === "a" ? round.a : pred === "b" ? round.b : "…"}.
          </p>
          <p className="text-fog">Waiting for everyone…</p>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-6 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-lose text-white"
              }`}
            >
              <div className="text-3xl font-extrabold">
                {myResult.gained > 0 ? `+${myResult.gained}` : "✗"}
              </div>
              <div className="font-semibold">
                {phaseData.majority === "tie"
                  ? "Tie — everybody scores!"
                  : myResult.gained > 0
                    ? "You read the room!"
                    : myResult.vote == null
                      ? "No vote in time"
                      : "The room went the other way"}
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
