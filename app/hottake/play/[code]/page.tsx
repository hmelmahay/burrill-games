"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { HotTakePhaseData } from "@/app/hottake/constants";

type HotTakeRound = { p: string };

export default function HotTakePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("hottake", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setSent(false);
  }, [room?.round_idx]);

  const round = room ? (room.rounds[room.round_idx] as HotTakeRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as HotTakePhaseData;
  const me = players.find((p) => p.id === playerId);
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );
  const locked = sent || !!mySub;
  const myTarget = (mySub?.payload as { target?: string } | undefined)?.target;
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

  async function vote(targetId: string) {
    if (!room || !playerId || locked) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { target: targetId },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (error)
    return (
      <Shell title="Hot Take" icon="🔥">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/hottake/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Hot Take" icon="🔥">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/hottake/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const iAmFamous = (phaseData.top ?? []).includes(playerId ?? "");

  return (
    <Shell title={`Hot Take · ${me.name}`} icon="🔥">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-card border-2 border-glow p-4 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">
              Who&apos;s most likely to…
            </div>
            <h1 className="text-xl font-extrabold">{round.p}</h1>
          </div>
          {!locked ? (
            <div className="grid grid-cols-2 gap-2">
              {players.map((p) => (
                <button
                  key={p.id}
                  onClick={() => vote(p.id)}
                  className={`rounded-xl p-4 font-bold border-2 border-line bg-card active:scale-95 transition ${
                    p.id === playerId ? "border-violet" : ""
                  }`}
                >
                  {p.name}
                  {p.id === playerId ? " (me!)" : ""}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="font-bold text-xl">
                🔒 You said {myTarget ? nameOf(myTarget) : "…"}
              </p>
              <p className="text-fog">Waiting for everyone…</p>
            </div>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-glow p-4 text-center">
            <div className="text-3xl">🏅</div>
            <div className="text-xl font-extrabold">
              {(phaseData.top ?? []).map(nameOf).join(" & ") || "No votes?"}
            </div>
            <div className="text-fog text-xs">most likely to {round.p}</div>
          </div>
          {myResult && (
            <div
              className={`rounded-2xl p-4 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-2xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm">
                {iAmFamous && "The room named YOU. "}
                {myResult.target && (phaseData.top ?? []).includes(myResult.target)
                  ? "You voted with the crowd."
                  : "The crowd went elsewhere."}
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
