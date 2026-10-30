"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ScatterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { POINTS_PER_ANSWER, ScatterPhaseData } from "@/app/scatter/constants";
import { PlayerPanel } from "@/app/scatter/PlayerPanel";

export default function ScatterPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("scatter", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as { roundSeconds?: number };
  const roundSeconds = settings.roundSeconds ?? 60;
  const round = room ? (room.rounds[room.round_idx] as ScatterRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ScatterPhaseData;
  const me = players.find((p) => p.id === playerId);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    roundSeconds,
    room?.phase === "write",
  );

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
        </div>
      )}

      {/* Mounted through judging so a sheet that wasn't sent yet still lands. */}
      {(room.phase === "write" || room.phase === "judge") && playerId && (
        <PlayerPanel room={room} subs={subs} playerId={playerId} left={left} />
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
