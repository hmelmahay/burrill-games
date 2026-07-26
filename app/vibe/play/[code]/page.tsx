"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { VibeRound, VibePhaseData } from "@/app/vibe/constants";
import { Dial, MARK_COLORS } from "@/app/vibe/Dial";
import { addBot, removeBot, botsOf, humansOf } from "@/lib/bots";
import { PlayerPanel } from "@/app/vibe/PlayerPanel";

export default function VibePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("vibe", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [botErr, setBotErr] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);


  const rounds = (room?.rounds ?? []) as VibeRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as VibePhaseData;
  const me = players.find((p) => p.id === playerId);



  if (error)
    return (
      <Shell title="Vibe Check" icon="🌡️">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/vibe/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Vibe Check" icon="🌡️">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/vibe/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);

  return (
    <Shell title={`Vibe Check · ${me.name}`} icon="🌡️">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">
            {humansOf(players).length} player
            {humansOf(players).length === 1 ? "" : "s"}
            {botsOf(players).length > 0 && ` + ${botsOf(players).length} bot${
              botsOf(players).length === 1 ? "" : "s"
            }`}
          </p>
          {/* The people actually playing should set the table size, not
              whoever happens to be holding the host screen. */}
          <div className="flex items-center gap-3 w-full max-w-xs mt-2">
            <button
              onClick={async () => setBotErr(await addBot(room, players))}
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
          {botErr && <p className="text-lose text-sm">{botErr}</p>}
        </div>
      )}

      {(room.phase === "clue" || room.phase === "guess") && playerId && (
        <PlayerPanel room={room} players={players} subs={subs} playerId={playerId} />
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-win p-4 text-center">
            <div className="text-fog text-sm">“{phaseData.clue}” lived at</div>
            <div className="text-3xl font-extrabold">{phaseData.target}/100</div>
            <div className="text-fog text-xs">
              {round.left} ← → {round.right}
            </div>
          </div>
          <Dial
            marks={(phaseData.results ?? [])
              .filter((r) => r.guess != null)
              .map((r, i) => ({
                pos: r.guess!,
                label: r.player_id === playerId ? `${r.name} (you)` : r.name,
                color: MARK_COLORS[i % MARK_COLORS.length],
              }))}
            target={phaseData.target}
            left={round.left}
            right={round.right}
          />
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="text-sm">
                {myResult.isPsychic
                  ? "Psychic bonus for dials near your spot"
                  : myResult.guess == null
                    ? "No dial in time"
                    : `Your dial: ${myResult.guess} (off by ${Math.abs(
                        (myResult.guess ?? 0) - (phaseData.target ?? 0),
                      )})`}
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
