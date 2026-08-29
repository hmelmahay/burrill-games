"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { ChainRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { Shell, Leaderboard, Countdown } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { ChainBoard } from "@/app/chain/ChainBoard";
import { RacePanel } from "@/app/chain/RacePanel";
import { DuelPanel } from "@/app/chain/DuelPanel";
import {
  ChainSettings,
  ChainPhaseData,
  FRESH_SIDE,
  duelChainIdx,
  HIDDEN_WORDS,
} from "@/app/chain/constants";

export default function ChainPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("chain", code);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  const settings = (room?.settings ?? {}) as ChainSettings;
  const mode = settings.mode ?? "race";
  const raceSeconds = settings.raceSeconds ?? 180;
  const duelSeconds = settings.duelSeconds ?? 20;
  const chainsAvailable = room
    ? mode === "duel"
      ? Math.floor(room.rounds.length / 2)
      : room.rounds.length
    : 0;
  const totalChains = Math.min(settings.numChains ?? 3, chainsAvailable);
  const round = room ? (room.rounds[room.round_idx] as ChainRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChainPhaseData;
  const duel = phaseData.duel;
  const me = players.find((p) => p.id === playerId);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    raceSeconds,
    room?.phase === "solve",
  );

  // Shot clock display: restarts whenever the duel state changes. The host
  // screen makes the actual call; this is just the phone's view of it.
  const duelKey = duel
    ? `${room?.round_idx}-${duel.turn}-${JSON.stringify(duel.sides)}`
    : "off";
  const duelLeft = useCountdown(duelKey, duelSeconds, room?.phase === "duel" && !!duel);

  if (error)
    return (
      <Shell title="Chain Gang" icon="⛓️">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/chain/play">
          Back to join
        </Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Chain Gang" icon="⛓️">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device.{" "}
            <Link className="underline" href="/chain/play">
              Join first.
            </Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const activePlayer = duel ? players.find((p) => p.id === duel.turn) : undefined;
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  const mySeat = players.findIndex((p) => p.id === me.id);
  const myChain =
    mySeat >= 0
      ? (room.rounds[duelChainIdx(room.round_idx, mySeat)] as ChainRound | undefined)
      : undefined;
  const mySide = duel?.sides[me.id] ?? FRESH_SIDE;
  const rival = players.find((p) => p.id !== me.id);
  const rivalSide = rival ? (duel?.sides[rival.id] ?? FRESH_SIDE) : undefined;

  const lastBanner = duel?.last && (
    <p className="text-center text-sm pop-in">
      {duel.last.kind === "hit" && (
        <span className="text-win font-bold">
          ✓ {duel.last.name} got {duel.last.word}!
        </span>
      )}
      {duel.last.kind === "miss" && (
        <span className="text-lose font-bold">
          ✗ {duel.last.name}: {duel.last.word.toUpperCase()} — turn passes
        </span>
      )}
      {duel.last.kind === "given" && (
        <span className="text-fog font-bold">
          {duel.last.word} ran out of letters — {duel.last.name} gets it for free
        </span>
      )}
    </p>
  );

  return (
    <Shell title={`Chain Gang · ${me.name}`} icon="⛓️">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">⛓️</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">
            {mode === "duel"
              ? `Head-to-head on your OWN chain: a miss shows one of your letters but hands over the turn. ${duelSeconds}s per turn — first to the bottom wins.`
              : "Every word pairs with the one before it. First to the bottom wins."}
          </p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "solve" && round && (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Chain {room.round_idx + 1}/{totalChains}
            </span>
          </div>
          {/* Sticky with the same backdrop as the guess box: the clock stays
              on screen while the chain scrolls between them. */}
          <div className="sticky top-0 z-10 -mx-1 rounded-b-xl bg-ink/95 px-1 pb-1.5 pt-1 backdrop-blur">
            <Countdown left={left} total={raceSeconds} />
          </div>
          <RacePanel room={room} round={round} playerId={playerId!} subs={subs} left={left} />
        </div>
      )}

      {room.phase === "duel" && duel && myChain && (
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Chain {room.round_idx + 1}/{totalChains}
            </span>
            <span>
              {duel.turn === me.id ? "your turn!" : `${activePlayer?.name ?? "…"}'s turn`}
            </span>
          </div>
          <div className="sticky top-0 z-10 -mx-1 rounded-b-xl bg-ink/95 px-1 pb-1.5 pt-1 backdrop-blur">
            <Countdown left={duelLeft} total={duelSeconds} />
          </div>
          {lastBanner}
          <p className="text-center text-sm font-bold">
            Your chain — {mySide.solved}/{HIDDEN_WORDS}
            {rival && rivalSide && (
              <span className="font-normal text-fog">
                {" "}
                · {rival.name}: {rivalSide.solved}/{HIDDEN_WORDS}
              </span>
            )}
          </p>
          <ChainBoard words={myChain.words} solved={mySide.solved} reveal={mySide.reveal} />
          {duel.turn === me.id ? (
            <DuelPanel room={room} myRound={myChain} players={players} me={me} duel={duel} />
          ) : (
            <p className="text-center text-fog">
              {activePlayer?.name ?? "They"} is on their own chain… a miss, a pass,
              or the clock makes it your turn.
            </p>
          )}
          <Leaderboard players={players} highlightId={playerId} />
        </div>
      )}

      {room.phase === "reveal" && (
        <div className="flex flex-col gap-4">
          {mode === "race" && myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                phaseData.winner === me.name ? "bg-win text-[#03180b]" : "bg-card border border-line"
              }`}
            >
              <div className="text-3xl font-extrabold">+{myResult.gained}</div>
              <div className="font-semibold">{myResult.detail}</div>
            </div>
          )}
          {mode === "race" && round && (
            <ChainBoard words={round.words} solved={HIDDEN_WORDS} reveal={1} showAll />
          )}
          {mode === "duel" && phaseData.duel && (
            <>
              <h1 className="text-2xl font-extrabold text-center pop-in">
                {phaseData.duel.winner === me.id
                  ? "🏆 You finished your chain first!"
                  : `${players.find((p) => p.id === phaseData.duel!.winner)?.name ?? "They"} finished first`}
              </h1>
              <div className="grid gap-3 sm:grid-cols-2">
                {players.map((p, seat) => {
                  const chain = room.rounds[
                    duelChainIdx(room.round_idx, seat)
                  ] as ChainRound | undefined;
                  if (!chain) return null;
                  return (
                    <div key={p.id} className="flex flex-col gap-2 rounded-xl border border-line p-2">
                      <p className="text-center font-bold">
                        {p.name}
                        {phaseData.duel!.winner === p.id && " 🏆"}
                      </p>
                      <ChainBoard words={chain.words} solved={HIDDEN_WORDS} reveal={1} showAll />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <Leaderboard
            players={players}
            gains={mode === "race" ? gains : undefined}
            highlightId={playerId}
          />
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
