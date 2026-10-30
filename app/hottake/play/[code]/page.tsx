"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { LobbyWait, Reveal, RevealScope, ResultCard, Stamp } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { joinNames } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { playerKey } from "@/lib/rooms";
import { HotTakePhaseData } from "@/app/hottake/constants";
import { PlayerPanel } from "@/app/hottake/PlayerPanel";
import { RoomSays } from "@/app/hottake/RoomSays";
import { REVEAL } from "@/app/hottake/reveal";

type HotTakeRound = { p: string };

export default function HotTakePlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("hottake", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  // Visual only: should this phone play the staged reveal for the current phase?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const round = room ? (room.rounds[room.round_idx] as HotTakeRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as HotTakePhaseData;
  const me = players.find((p) => p.id === playerId);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "?";

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
  const top = phaseData.top ?? [];
  const iAmFamous = top.includes(playerId ?? "");
  const crowdLine = !myResult?.target
    ? "No vote in time."
    : top.includes(myResult.target)
      ? "You voted with the crowd."
      : "The crowd went elsewhere.";
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title={`Hot Take · ${me.name}`} icon="🔥">
      {room.phase === "lobby" && <LobbyWait me={me} players={players} />}

      {room.phase === "vote" && round && (
        <div className="flex flex-col gap-3">
          <div className="neon-panel p-4 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">
              Who&apos;s most likely to…
            </div>
            <h1 className="text-xl font-extrabold">{round.p}</h1>
          </div>
          {playerId && (
            <PlayerPanel room={room} players={players} subs={subs} playerId={playerId} />
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <RoomSays names={joinNames(top.map(nameOf)) || "No votes?"} tie={top.length > 1} prompt={round.p} compact />
            {/* After the room's pick lands on every screen: the points would give it away. */}
            {myResult && (
              <ResultCard
                tone={myResult.gained > 0 ? "win" : "neutral"}
                points={myResult.gained > 0 ? myResult.gained : undefined}
                title={iAmFamous ? "The room named YOU." : crowdLine}
                celebrate={iAmFamous}
                delayMs={REVEAL.card}
              >
                {iAmFamous && (
                  <>
                    <div className="text-sm">{crowdLine}</div>
                    <div className="mt-3">
                      {/* Its own beat once the card has landed. */}
                      <Stamp tone="gold" size="lg" delayMs={460}>
                        👑 Named
                      </Stamp>
                    </div>
                  </>
                )}
              </ResultCard>
            )}
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} highlightId={playerId} gains={gains} />
            </Reveal>
            <p className="text-fog text-sm text-center">Waiting for the host…</p>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={playerId} size="phone" staged={staged} />
      )}
    </Shell>
  );
}
