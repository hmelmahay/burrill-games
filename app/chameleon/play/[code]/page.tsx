"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { WordGrid } from "@/app/chameleon/WordGrid";
import { PlayerPanel } from "@/app/chameleon/PlayerPanel";
import {
  ESCAPE_POINTS,
  CAUGHT_BUT_GUESSED_POINTS,
  CATCHERS_POINTS,
  ChamRound,
  ChamPhaseData,
} from "@/app/chameleon/constants";

export default function ChameleonPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("chameleon", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const rounds = (room?.rounds ?? []) as ChamRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChamPhaseData;
  const me = players.find((p) => p.id === playerId);

  if (error)
    return (
      <Shell title="Chameleon" icon="🦎">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/chameleon/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Chameleon" icon="🦎">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/chameleon/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const iWasChameleon = round?.chameleon_id === playerId;

  return (
    <Shell title={`Chameleon · ${me.name}`} icon="🦎">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">
            {players.length} player{players.length === 1 ? "" : "s"} so far
          </p>
        </div>
      )}

      {(room.phase === "clue" || room.phase === "vote" || room.phase === "guess") && playerId && (
        <>
          {room.phase === "clue" && round && (
            <p className="text-fog text-sm text-center mb-3">
              Round {room.round_idx + 1}/{rounds.length} · topic: <b>{round.topic}</b>
            </p>
          )}
          <PlayerPanel room={room} players={players} subs={subs} playerId={playerId} />
        </>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div
            className={`rounded-2xl border-2 p-4 text-center ${
              iWasChameleon
                ? (myResult?.gained ?? 0) > 0
                  ? "border-win bg-win/10"
                  : "border-lose bg-lose/10"
                : "border-line bg-card"
            }`}
          >
            <div className="text-2xl">🦎</div>
            <div className="text-lg font-extrabold">
              {round.chameleon_name} was the Chameleon
            </div>
            <p className="text-fog text-sm mt-1">
              {!phaseData.caught
                ? `They escaped the vote! +${ESCAPE_POINTS} for the Chameleon.`
                : phaseData.guess_idx === round.secret_idx
                  ? `Caught, but guessed the word! +${CAUGHT_BUT_GUESSED_POINTS} for the Chameleon.`
                  : `Caught and guessed wrong — everyone else +${CATCHERS_POINTS}.`}
            </p>
          </div>
          <WordGrid
            words={round.words}
            highlightIdx={round.secret_idx}
            pickedIdx={
              phaseData.guess_idx != null && phaseData.guess_idx !== round.secret_idx
                ? phaseData.guess_idx
                : null
            }
          />
          {myResult && myResult.gained > 0 && (
            <div className="rounded-2xl bg-win text-[#03180b] p-5 text-center pop-in">
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm">
                {myResult.wasChameleon ? "Slippery. Very slippery." : "You saw right through them."}
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
