"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { MajorityRound } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { MajorityPhaseData } from "@/app/majority/constants";
import { PlayerPanel } from "@/app/majority/PlayerPanel";

export default function MajorityPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("majority", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const round = room ? (room.rounds[room.round_idx] as MajorityRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as MajorityPhaseData;
  const me = players.find((p) => p.id === playerId);

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

      {room.phase === "vote" && round && playerId && (
        <PlayerPanel room={room} subs={subs} playerId={playerId} />
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
