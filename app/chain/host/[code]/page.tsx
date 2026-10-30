"use client";

import { useEffect, useRef, useState, use } from "react";
import Link from "next/link";
import { supabase, ChainRound, Sub } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
  HostSeatCard,
} from "@/app/components/ui";
import { Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";
import { FinalStandings } from "@/app/components/FinalStandings";
import { useHostSeat } from "@/lib/useHostSeat";
import { useStaged } from "@/lib/motion";
import { ChainBoard } from "@/app/chain/ChainBoard";
import { RaceBoard } from "@/app/chain/RaceBoard";
import { RacePanel } from "@/app/chain/RacePanel";
import { DuelPanel } from "@/app/chain/DuelPanel";
import { REVEAL } from "@/app/chain/reveal";
import {
  ChainSettings,
  ChainPhaseData,
  ChainResult,
  DuelState,
  DuelSide,
  FRESH_SIDE,
  RaceProgress,
  duelOpener,
  duelChainIdx,
  HIDDEN_WORDS,
  WIN_BONUS,
} from "@/app/chain/constants";

export default function ChainHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("chain", code);
  const { tv, tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as ChainSettings;
  const mode = settings.mode ?? "race";
  const raceSeconds = settings.raceSeconds ?? 180;
  const duelSeconds = settings.duelSeconds ?? 20;
  // A duel burns two chains per round (one per seat), a race one.
  const chainsAvailable =
    mode === "duel"
      ? Math.floor((room?.rounds.length ?? 0) / 2)
      : (room?.rounds.length ?? 0);
  const totalChains = Math.min(settings.numChains ?? 3, chainsAvailable);
  const round = room ? (room.rounds[room.round_idx] as ChainRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChainPhaseData;
  const duel = phaseData.duel;

  const seat = useHostSeat("chain", code, players, refresh, playersLoaded);
  const { playerId, me, canPlay } = seat;

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    raceSeconds,
    room?.phase === "solve",
  );
  // Play the reveal and the podium only for a screen that saw them start.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  // Duel turn order = join order; the opener alternates each chain.
  const playerIds = players.map((p) => p.id);

  function duelInit(chainIdx: number): DuelState {
    const sides: Record<string, DuelSide> = {};
    for (const id of playerIds) sides[id] = { ...FRESH_SIDE };
    return { sides, turn: duelOpener(playerIds, chainIdx), last: null, winner: null };
  }

  function duelChainOf(seat: number): ChainRound | undefined {
    if (!room) return undefined;
    return room.rounds[duelChainIdx(room.round_idx, seat)] as ChainRound | undefined;
  }

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({
        status: "playing",
        phase: mode === "duel" ? "duel" : "solve",
        round_idx: 0,
        phase_data: mode === "duel" ? { duel: duelInit(0) } : {},
      })
      .eq("id", room.id);
    setBusy(false);
  }

  // Race scoring: word points banked on each phone, +bonus to the first
  // finisher — finish order comes from the server-stamped reinsert.
  async function revealRace() {
    if (!room || room.phase !== "solve") return;
    if (revealingRef.current === room.round_idx) return; // fire once per chain
    revealingRef.current = room.round_idx;
    setBusy(true);
    const { data: subRows } = await supabase
      .from("arcade_subs")
      .select("*")
      .eq("room_id", room.id)
      .eq("round_idx", room.round_idx)
      .order("created_at", { ascending: true });
    const rows = (subRows ?? []) as Sub[];
    const firstDone = rows.find((r) => (r.payload as unknown as RaceProgress).done);
    const results: ChainResult[] = players.map((p) => {
      const sub = rows.find((r) => r.player_id === p.id);
      const prog = (sub?.payload ?? {}) as Partial<RaceProgress>;
      const bonus = firstDone && sub?.id === firstDone.id ? WIN_BONUS : 0;
      return {
        player_id: p.id,
        name: p.name,
        gained: (prog.score ?? 0) + bonus,
        detail:
          `${prog.solved ?? 0}/${HIDDEN_WORDS} words` +
          (prog.hints ? ` · ${prog.hints} letter${prog.hints === 1 ? "" : "s"} bought` : "") +
          (bonus ? ` · 🏁 first! +${bonus}` : ""),
      };
    });
    await Promise.all(
      results
        .filter((r) => r.gained > 0)
        .map((r) => {
          const p = players.find((x) => x.id === r.player_id);
          return supabase
            .from("arcade_players")
            .update({ score: (p?.score ?? 0) + r.gained })
            .eq("id", r.player_id);
        }),
    );
    const winner = firstDone
      ? (players.find((p) => p.id === firstDone.player_id)?.name ?? null)
      : null;
    await supabase
      .from("arcade_rooms")
      .update({ phase: "reveal", phase_data: { results, winner } })
      .eq("id", room.id);
    setBusy(false);
  }

  // End the race the moment someone finishes, or when both clocks agree the
  // time is up (server-stamped start AND the local countdown — a host tab
  // opened mid-round can't cut it short). TV copies never run this.
  const someoneDone = subs.some(
    (s) =>
      s.round_idx === room?.round_idx && (s.payload as unknown as RaceProgress).done,
  );
  const deadlinePassed =
    left === 0 &&
    (!room?.phase_started_at ||
      Date.now() >= new Date(room.phase_started_at).getTime() + (raceSeconds + 2) * 1000);
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase !== "solve" || players.length === 0) return;
    if (someoneDone || deadlinePassed) revealRace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [someoneDone, deadlinePassed, room?.phase]);

  // Background tabs throttle timers; force a render when fronted again so an
  // overdue reveal or shot clock fires immediately (same pattern as Quiz Rush).
  const [, wake] = useState(0);
  useEffect(() => {
    const onWake = () => wake((n) => n + 1);
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalChains;
    const idx = room.round_idx + 1;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : {
              phase: mode === "duel" ? "duel" : "solve",
              round_idx: idx,
              phase_data: mode === "duel" ? { duel: duelInit(idx) } : {},
            },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  // Force a pass on the active player: their stuck word shows one more letter
  // and the turn swaps. Fired by the shot clock below, or by the host button
  // when someone wandered off.
  async function forcePass(reason: "clock" | "host") {
    if (!room || !duel) return;
    const seat = players.findIndex((p) => p.id === duel.turn);
    if (seat < 0) return;
    const chain = duelChainOf(seat);
    const side = duel.sides[duel.turn] ?? FRESH_SIDE;
    const target = chain?.words[side.solved + 1];
    if (!target) return;
    const active = players[seat];
    const other = players.find((p) => p.id !== duel.turn);
    const reveal = side.reveal + 1;
    const given = reveal >= target.length;
    const solved = given ? side.solved + 1 : side.solved;
    const won = solved >= HIDDEN_WORDS;
    const nextDuel: DuelState = {
      sides: {
        ...duel.sides,
        [duel.turn]: given ? { solved, reveal: 1 } : { solved, reveal },
      },
      turn: other?.id ?? duel.turn,
      last: given
        ? { name: active?.name ?? "?", word: target, kind: "given" }
        : {
            name: active?.name ?? "?",
            word: reason === "clock" ? "out of time" : "skipped",
            kind: "miss",
          },
      winner: won ? duel.turn : null,
    };
    await supabase
      .from("arcade_rooms")
      .update(
        won
          ? { phase: "reveal", phase_data: { duel: nextDuel } }
          : { phase_data: { duel: nextDuel } },
      )
      .eq("id", room.id);
  }

  // Duel shot clock. There's no server stamp for turn changes (they live in
  // phase_data), so the host screen is the timekeeper: the countdown restarts
  // whenever the duel state it can see changes, and fires exactly once per
  // state. Clock skew on phones only affects their display, never the call.
  const duelKey = duel
    ? `${room?.round_idx}-${duel.turn}-${JSON.stringify(duel.sides)}`
    : "off";
  const duelLeft = useCountdown(duelKey, duelSeconds, room?.phase === "duel" && !!duel);
  const shotRef = useRef<string | null>(null);
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase !== "duel" || !duel || duelLeft > 0) return;
    if (shotRef.current === duelKey) return;
    shotRef.current = duelKey;
    forcePass("clock");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duelLeft, room?.phase, duelKey]);

  if (error)
    return (
      <Shell title="Chain Gang" icon="⛓️">
        <p className="text-lose">{error}</p>
      </Shell>
    );
  if (!room)
    return (
      <Shell title="Chain Gang" icon="⛓️">
        <p className="text-fog">Loading…</p>
      </Shell>
    );

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const canStart = mode === "duel" ? players.length === 2 : players.length >= 1;
  const activePlayer = duel ? players.find((p) => p.id === duel.turn) : undefined;
  const mySeat = players.findIndex((p) => p.id === playerId);
  const myChain = mySeat >= 0 ? duelChainOf(mySeat) : undefined;

  // Race progress board: solved counts straight from the live subs.
  const raceRows = players
    .map((p) => {
      const sub = subs.find(
        (s) => s.player_id === p.id && s.round_idx === room.round_idx,
      );
      const prog = (sub?.payload ?? {}) as Partial<RaceProgress>;
      return { p, solved: prog.solved ?? 0, done: !!prog.done };
    })
    .sort((a, b) => b.solved - a.solved);

  // Keyed on the duel state, so it replays on every move:  a hit pops, a miss shakes.
  const lastBanner = duel?.last && (
    <p key={duelKey} className={`text-center text-sm ${duel.last.kind === "miss" ? "fx-shake" : "pop-in"}`}>
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

  const duelBoards = (showAll: boolean) =>
    duel && (
      <div className="grid gap-3 sm:grid-cols-2">
        {players.map((p, seat) => {
          const chain = duelChainOf(seat);
          if (!chain) return null;
          const side = duel.sides[p.id] ?? FRESH_SIDE;
          const active = !showAll && duel.turn === p.id;
          return (
            <div
              key={p.id}
              className={`flex flex-col gap-2 p-2 ${
                active ? "neon-panel" : "rounded-2xl border border-line"
              }`}
            >
              <p className="text-center font-bold">
                {active && "▶ "}
                {p.name} — {side.solved}/{HIDDEN_WORDS}
                {showAll && duel.winner === p.id && " 🏆"}
              </p>
              <ChainBoard
                words={chain.words}
                solved={side.solved}
                reveal={side.reveal}
                showAll={showAll}
                cascade={showAll}
              />
            </div>
          );
        })}
      </div>
    );

  // Reveal headline:  the Finish stamp and the winner, or Time! if nobody finished.
  const finishLine = (winner: string | null | undefined) => (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
      {winner ? (
        <>
          <Stamp tone="gold" size="lg">
            Finish!
          </Stamp>
          <span className="font-display neon-text min-w-0 break-words text-2xl">{winner}</span>
          <Confetti />
        </>
      ) : (
        <Stamp tone="lose">Time!</Stamp>
      )}
    </div>
  );

  return (
    <Shell
      title="Chain Gang · host"
      icon="⛓️"
      attractKey={room.phase === "lobby" ? players.length : undefined}
    >
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            {mode === "duel"
              ? `Duel needs exactly two players — each gets their OWN chain. Miss and one of your letters shows, but the turn swaps. ${duelSeconds}s per turn; first to the bottom of their chain wins.`
              : "Race mode: everyone gets the same chain. First to the bottom wins the round."}
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || !canStart} attention={canStart}>
            {!canStart
              ? mode === "duel"
                ? players.length < 2
                  ? "Waiting for 2 players…"
                  : "A duel takes exactly 2 players"
                : "Waiting for a player…"
              : `Start (${totalChains} chain${totalChains === 1 ? "" : "s"})`}
          </BigBtn>
        </div>
      )}

      {room.phase === "solve" && round && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Chain {room.round_idx + 1}/{totalChains}
            </span>
            <span>starts with {round.words[0]}</span>
          </div>
          <Countdown left={left} total={raceSeconds} />
          {canPlay ? (
            <RacePanel room={room} round={round} playerId={playerId!} subs={subs} left={left} />
          ) : (
            <RaceBoard rows={raceRows} />
          )}
          <BigBtn onClick={revealRace} disabled={busy} color="ghost">
            End the round now
          </BigBtn>
        </div>
      )}

      {room.phase === "duel" && duel && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Chain {room.round_idx + 1}/{totalChains}
            </span>
            <span>{activePlayer ? `${activePlayer.name}'s turn` : "…"}</span>
          </div>
          <Countdown left={duelLeft} total={duelSeconds} />
          {lastBanner}
          {duelBoards(false)}
          {canPlay && me && myChain && duel.turn === me.id ? (
            <DuelPanel room={room} myRound={myChain} players={players} me={me} duel={duel} />
          ) : (
            <p className="text-center text-fog">
              Waiting on {activePlayer?.name ?? "the active player"}…
            </p>
          )}
          <Leaderboard players={players} highlightId={playerId} />
          {!tv && (
            <button
              onClick={() => forcePass("host")}
              disabled={busy}
              className="self-center rounded-lg border border-line px-4 py-1.5 text-sm text-fog hover:border-lose"
            >
              Player stuck or gone? Pass their turn
            </button>
          )}
        </div>
      )}

      {room.phase === "reveal" && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Chain {room.round_idx + 1}/{totalChains}
            </p>
            {mode === "race" ? (
              <>
                {finishLine(phaseData.winner)}
                {round && (
                  <ChainBoard words={round.words} solved={HIDDEN_WORDS} reveal={1} showAll cascade />
                )}
                {(phaseData.results ?? []).length > 0 && (
                  <Reveal kind="fade" delayMs={REVEAL.board} className="flex flex-col gap-1 text-sm text-fog">
                    {(phaseData.results ?? []).map((r) => (
                      <p key={r.player_id} className="text-center">
                        <span className="font-semibold text-white">{r.name}</span> — {r.detail}
                      </p>
                    ))}
                  </Reveal>
                )}
              </>
            ) : (
              <>
                {finishLine(
                  players.find((p) => p.id === phaseData.duel?.winner)?.name ?? "Someone",
                )}
                {duelBoards(true)}
              </>
            )}
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard
                players={players}
                gains={mode === "race" ? gains : undefined}
                highlightId={playerId}
              />
            </Reveal>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= totalChains ? "Finish game" : "Next chain"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={playerId} size="host" staged={staged}>
          <Link href="/chain/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}
