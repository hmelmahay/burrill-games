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
} from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { ChainBoard } from "@/app/chain/ChainBoard";
import { RacePanel } from "@/app/chain/RacePanel";
import { DuelPanel } from "@/app/chain/DuelPanel";
import {
  ChainSettings,
  ChainPhaseData,
  ChainResult,
  DuelState,
  RaceProgress,
  duelOpener,
  HIDDEN_WORDS,
  RACE_WIN_BONUS,
} from "@/app/chain/constants";

export default function ChainHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("chain", code);
  const { tv, tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const revealingRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as ChainSettings;
  const mode = settings.mode ?? "race";
  const raceSeconds = settings.raceSeconds ?? 180;
  const totalChains = Math.min(settings.numChains ?? 3, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as ChainRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ChainPhaseData;
  const duel = phaseData.duel;

  const [playerId, setPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  const me = players.find((p) => p.id === playerId);
  const canPlay = !!me && !tv;

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    raceSeconds,
    room?.phase === "solve",
  );

  // Duel turn order = join order; the opener alternates each chain.
  const playerIds = players.map((p) => p.id);

  function duelInit(chainIdx: number): DuelState {
    return {
      solved: 0,
      reveal: 1,
      turn: duelOpener(playerIds, chainIdx),
      last: null,
    };
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
      const bonus = firstDone && sub?.id === firstDone.id ? RACE_WIN_BONUS : 0;
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
  // overdue reveal fires immediately (same pattern as Quiz Rush).
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

  // Unstick a duel whose active player wandered off: same as a pass, applied
  // from the host screen — a letter shows and the turn swaps.
  async function nudgeTurn() {
    if (!room || !round || !duel) return;
    const target = round.words[duel.solved + 1];
    if (!target) return;
    setBusy(true);
    const active = players.find((p) => p.id === duel.turn);
    const other = players.find((p) => p.id !== duel.turn);
    const reveal = duel.reveal + 1;
    const given = reveal >= target.length;
    const solved = given ? duel.solved + 1 : duel.solved;
    const nextDuel: DuelState = {
      solved,
      reveal: given ? 1 : reveal,
      turn: other?.id ?? duel.turn,
      last: given
        ? { name: active?.name ?? "?", word: target, kind: "given" }
        : { name: active?.name ?? "?", word: "skipped", kind: "miss" },
    };
    await supabase
      .from("arcade_rooms")
      .update(
        solved >= HIDDEN_WORDS
          ? { phase: "reveal", phase_data: { duel: nextDuel } }
          : { phase_data: { duel: nextDuel } },
      )
      .eq("id", room.id);
    setBusy(false);
  }

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

  return (
    <Shell title="Chain Gang · host" icon="⛓️">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} game="chain" />
          <p className="text-center text-fog text-sm">
            {mode === "duel"
              ? "Duel needs exactly two players. Ten words per chain — miss and your rival gets a letter."
              : "Race mode: everyone gets the same chain. First to the bottom wins the round."}
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || !canStart}>
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
            <div className="flex flex-col gap-1.5">
              {raceRows.map(({ p, solved, done }) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg bg-card border border-line px-3 py-2"
                >
                  <span className="flex-1 font-semibold truncate">{p.name}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: HIDDEN_WORDS }, (_, i) => (
                      <span
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${
                          i < solved ? "bg-win" : "bg-line"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-sm w-10 text-right">
                    {done ? "🏁" : `${solved}/${HIDDEN_WORDS}`}
                  </span>
                </div>
              ))}
            </div>
          )}
          <BigBtn onClick={revealRace} disabled={busy} color="ghost">
            End the round now
          </BigBtn>
        </div>
      )}

      {room.phase === "duel" && round && duel && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Chain {room.round_idx + 1}/{totalChains}
            </span>
            <span>
              {activePlayer ? `${activePlayer.name}'s turn` : "…"}
            </span>
          </div>
          <ChainBoard words={round.words} solved={duel.solved} reveal={duel.reveal} />
          {duel.last && (
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
                  {duel.last.word} ran out of letters — no points
                </span>
              )}
            </p>
          )}
          {canPlay && me && duel.turn === me.id ? (
            <DuelPanel room={room} round={round} players={players} me={me} duel={duel} />
          ) : (
            <p className="text-center text-fog">
              Waiting on {activePlayer?.name ?? "the active player"}…
            </p>
          )}
          <Leaderboard players={players} highlightId={playerId} />
          {!tv && (
            <button
              onClick={nudgeTurn}
              disabled={busy}
              className="self-center rounded-lg border border-line px-4 py-1.5 text-sm text-fog hover:border-lose"
            >
              Player stuck or gone? Pass their turn
            </button>
          )}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Chain {room.round_idx + 1}/{totalChains}
          </p>
          {mode === "race" && (
            <h1 className="text-2xl font-extrabold text-center">
              {phaseData.winner ? `🏁 ${phaseData.winner} finished first!` : "⏰ Time!"}
            </h1>
          )}
          <ChainBoard words={round.words} solved={HIDDEN_WORDS} reveal={1} showAll />
          {mode === "race" && (phaseData.results ?? []).length > 0 && (
            <div className="flex flex-col gap-1 text-sm text-fog">
              {(phaseData.results ?? []).map((r) => (
                <p key={r.player_id} className="text-center">
                  <span className="font-semibold text-white">{r.name}</span> — {r.detail}
                </p>
              ))}
            </div>
          )}
          <Leaderboard players={players} gains={mode === "race" ? gains : undefined} highlightId={playerId} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= totalChains ? "Finish game" : "Next chain"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} highlightId={playerId} />
          </div>
          <Link href="/chain/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
