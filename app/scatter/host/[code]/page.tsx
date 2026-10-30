"use client";

import { useMemo, useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase, ScatterRound } from "@/lib/supabase";
import { useRoom, useCountdown } from "@/lib/useRoom";
import {
  Shell,
  CodeBadge,
  BigBtn,
  Countdown,
  Leaderboard,
  PlayerChips,
  HostSeatCard,
} from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope, SlotReel, Stamp } from "@/app/components/fx";
import { FinalStandings } from "@/app/components/FinalStandings";
import { FX, stagger, type Tone } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { judgeCellStates, JudgeOverride } from "@/lib/content/scatter";
import { useHostSeat } from "@/lib/useHostSeat";
import { PlayerPanel } from "@/app/scatter/PlayerPanel";
import {
  POINTS_PER_ANSWER,
  ScatterPhaseData,
  ScatterResult,
  CellState,
} from "@/app/scatter/constants";

type SubRow = { player_id: string; payload: { answers?: string[] } };

export default function ScatterHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("scatter", code);
  const seat = useHostSeat("scatter", code, players, refresh, playersLoaded);
  const [busy, setBusy] = useState(false);
  // Host overrules, keyed `${playerId}:${catIdx}`: "reject" tosses a scoring
  // answer, "accept" rescues a duplicate or wrong-letter one.
  const [overrides, setOverrides] = useState<Map<string, JudgeOverride>>(
    new Map(),
  );
  const scoringRef = useRef<number | null>(null);

  const settings = (room?.settings ?? {}) as { numRounds?: number; roundSeconds?: number };
  const roundSeconds = settings.roundSeconds ?? 60;
  const totalRounds = room?.rounds.length ?? 0;
  const round = room ? (room.rounds[room.round_idx] as ScatterRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as ScatterPhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx) as unknown as (SubRow & {
    round_idx: number;
  })[];

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    roundSeconds,
    room?.phase === "write",
  );
  // Play the letter reel, reveal and podium only for a screen that saw them start.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  async function startGame() {
    if (!room) return;
    setBusy(true);
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "write", round_idx: 0, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  // The host's own sheet goes in before the round flips to judging, so the
  // judging grid never shows a seated host as blank.
  const handInRef = useRef<(() => Promise<boolean>) | null>(null);

  async function startJudging() {
    if (!room) return;
    setBusy(true);
    setOverrides(new Map());
    if (seat.canPlay && (await handInRef.current?.()) === false) await handInRef.current?.();
    await refresh(); // pick up any last-second submissions
    await supabase.from("arcade_rooms").update({ phase: "judge" }).eq("id", room.id);
    setBusy(false);
  }

  // Judging grid: per player per category, with auto-flags.
  const grid = useMemo(() => {
    if (!round) return [];
    return players.map((p) => {
      const sub = roundSubs.find((s) => s.player_id === p.id);
      const answers = sub?.payload.answers ?? [];
      return {
        player: p,
        answers: round.categories.map((_, ci) => answers[ci] ?? ""),
      };
    });
  }, [players, roundSubs, round]);

  // Live cell states, shown in the judge grid AND used verbatim by scoring so
  // the host resolves duplicates before scoring instead of discovering the
  // cancellations one phase later. An "accept" overrule always scores (and its
  // answer still counts against unrescued twins); a "reject" always tosses.
  const cellStates = useMemo(() => {
    if (!round) return [] as CellState[][];
    return judgeCellStates(
      grid.map(({ player, answers }) => ({ id: player.id, answers })),
      round.letter,
      round.categories.length,
      overrides,
    );
  }, [grid, overrides, round]);

  // Tap to overrule the automatic call; tap again to restore it.
  function tapCell(playerId: string, catIdx: number, effective: CellState) {
    if (effective === "empty") return;
    const key = `${playerId}:${catIdx}`;
    setOverrides((prev) => {
      const next = new Map(prev);
      if (next.has(key)) next.delete(key);
      else if (effective === "ok") next.set(key, "reject");
      else next.set(key, "accept"); // dupe, invalid or rejected → rescue it
      return next;
    });
  }

  async function finishJudging() {
    if (!room || !round || room.phase !== "judge") return;
    if (scoringRef.current === room.round_idx) return;
    scoringRef.current = room.round_idx;
    setBusy(true);

    const results: ScatterResult[] = grid.map(({ player, answers }, pi) => {
      const cells = answers.map((a, ci) => ({ a, s: cellStates[pi][ci] }));
      const gained = cells.filter((c) => c.s === "ok").length * POINTS_PER_ANSWER;
      return { player_id: player.id, name: player.name, gained, cells };
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

    await supabase
      .from("arcade_rooms")
      .update({ phase: "reveal", phase_data: { results } })
      .eq("id", room.id);
    setBusy(false);
  }

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= totalRounds;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "write", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  // Reset the double-score guard when moving to a new round.
  useEffect(() => {
    if (room?.phase === "write") scoringRef.current = null;
  }, [room?.phase, room?.round_idx]);

  if (error) return <Shell title="Scatter Sprint" icon="📝"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Scatter Sprint" icon="📝"><p className="text-fog">Loading…</p></Shell>;

  const results = phaseData.results ?? [];
  const gains: Record<string, number> = {};
  results.forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell
      title="Scatter Sprint · host"
      icon="📝"
      attractKey={room.phase === "lobby" ? players.length : undefined}
    >
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Scatter Sprint → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 2}
            attention={players.length >= 2}
          >
            {players.length < 2 ? "Need at least 2 players…" : `Start (${totalRounds} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "write" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{totalRounds}
          </p>
          <Countdown left={left} total={roundSeconds} doneLabel="Pencils down" />
          <div className="neon-panel p-6 text-center">
            <div className="text-xs text-fog uppercase tracking-[0.3em]">The letter is</div>
            {/* The reel rolls once, only on a screen that saw the round start.
                Phones show the letter at once. */}
            <RevealScope staged={staged}>
              <div className="text-7xl font-extrabold text-glow">
                <SlotReel
                  key={room.round_idx}
                  value={round.letter}
                  seed={room.round_idx * 31 + round.letter.charCodeAt(0)}
                />
              </div>
            </RevealScope>
          </div>
          {!seat.canPlay && (
            <ul className="rounded-xl bg-card border border-line divide-y divide-line">
              {round.categories.map((c) => (
                <li key={c} className="px-4 py-3 font-semibold">{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* The host's own sheet. It stays mounted into judging (hidden there) so
          answers not yet handed in still land when the round ends early. */}
      {seat.canPlay && seat.playerId && (room.phase === "write" || room.phase === "judge") && (
        <div
          className={
            room.phase === "write" ? "rounded-2xl border-2 border-violet bg-card/60 p-4" : "hidden"
          }
        >
          <PlayerPanel
            room={room}
            subs={subs}
            playerId={seat.playerId}
            left={left}
            handInRef={handInRef}
            conceal
          />
        </div>
      )}

      {room.phase === "write" && round && (
        <div className="flex flex-col gap-4">
          <LockInRow players={players} doneIds={roundSubs.map((s) => s.player_id)} label="handed in" />
          <BigBtn
            onClick={startJudging}
            disabled={busy}
            color={left === 0 ? "glow" : "ghost"}
            attention={left === 0}
          >
            {left === 0 ? "Pencils down — judge answers" : "End round early"}
          </BigBtn>
        </div>
      )}

      {/* Staged like a reveal: a screen that saw judging start stamps each call
          (and every overrule after it); one that joined late shows them at rest. */}
      {room.phase === "judge" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            {seat.tv ? (
              <>
                <h1 className="text-xl font-extrabold text-center">
                  The host is judging. Duplicates cancel out.
                </h1>
                <p className="text-fog text-sm text-center">Letter {round.letter}</p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-extrabold text-center">
                  Judging — tap an answer to overrule the call
                </h1>
                <p className="text-fog text-sm text-center">
                  Letter {round.letter}. Duplicates cancel out live as you judge. Tap a
                  duplicate or wrong-letter answer to accept it anyway, tap a good answer
                  to reject it — tap again to undo. What you see here is exactly what
                  scores.
                </p>
              </>
            )}
            {round.categories.map((cat, ci) => (
              <div key={ci} className="rounded-xl bg-card border border-line p-3">
                <h2 className="font-bold mb-2">{cat}</h2>
                <div className="flex flex-wrap gap-2">
                  {grid.map(({ player, answers }, pi) => {
                    const a = answers[ci];
                    const s = cellStates[pi]?.[ci] ?? "empty";
                    const accepted = overrides.get(`${player.id}:${ci}`) === "accept";
                    const styles: Record<CellState, string> = {
                      empty: "opacity-30 border-line",
                      // Faded by color, not opacity, so its stamp stays readable.
                      invalid: "border-line text-fog line-through",
                      dupe: "bg-glow/15 border-glow line-through",
                      rejected: "bg-lose/30 border-lose line-through",
                      ok: accepted
                        ? "bg-win/20 border-win"
                        : "border-line bg-ink",
                    };
                    const verdict = s === "ok" ? (accepted ? ACCEPTED : null) : VERDICT[s];
                    const chipClass = `rounded-lg px-3 py-2 text-sm border text-left ${styles[s]}`;
                    const body = (
                      <>
                        <span className="block text-xs text-fog">{player.name}</span>
                        {a.trim() || "—"}
                        {verdict ? (
                          <span className="block mt-1">
                            {/* Keyed on the call, so every overrule stamps again. */}
                            <Stamp key={s + (accepted ? "a" : "")} size="sm" tone={verdict.tone}>
                              {verdict.label}
                            </Stamp>
                          </span>
                        ) : (
                          s === "ok" && (
                            <span className="block text-xs text-win">+{POINTS_PER_ANSWER}</span>
                          )
                        )}
                      </>
                    );
                    // A TV copy hides every button, so it shows the same chip as a div.
                    return seat.tv ? (
                      <div key={player.id} className={chipClass}>
                        {body}
                      </div>
                    ) : (
                      <button
                        key={player.id}
                        onClick={() => tapCell(player.id, ci, s)}
                        disabled={s === "empty"}
                        className={`${chipClass} press`}
                      >
                        {body}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <BigBtn onClick={finishJudging} disabled={busy}>
              Score this round
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{totalRounds} scored · letter {round.letter}
            </p>
            <Leaderboard players={players} gains={gains} highlightId={seat.playerId} />
            {/* Open on a TV copy, where nobody can tap it. */}
            <details open={seat.tv} className="rounded-xl bg-card border border-line p-3">
              <summary className="font-bold cursor-pointer">Answer breakdown</summary>
              <div className="mt-2 flex flex-col gap-3">
                {results.map((r, ri) => (
                  <Reveal
                    key={r.player_id}
                    kind="rise"
                    delayMs={stagger(ri, results.length, FX.stagger, 600)}
                  >
                    <h3 className="font-semibold text-sm">{r.name} · +{r.gained}</h3>
                    <ul className="text-sm text-fog">
                      {r.cells.map((cell, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className={cell.s === "ok" ? "" : "line-through opacity-60"}>
                            {round.categories[i]}: {cell.a || "—"}
                          </span>
                          <span>
                            {cell.s === "ok" && `+${POINTS_PER_ANSWER}`}
                            {cell.s === "dupe" && "duplicate"}
                            {cell.s === "invalid" && "wrong letter"}
                            {cell.s === "rejected" && "rejected"}
                            {cell.s === "empty" && ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Reveal>
                ))}
              </div>
            </details>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= totalRounds ? "Finish game" : "Next round"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <FinalStandings players={players} highlightId={seat.playerId} size="host" staged={staged}>
          <Link href="/scatter/host" className="tv-hide underline text-fog">
            Play again with a new room
          </Link>
        </FinalStandings>
      )}
    </Shell>
  );
}

// The stamp each judged answer wears. A scoring answer the host left alone
// keeps its plain "+100" instead.
const VERDICT: Record<CellState, { label: string; tone: Tone } | null> = {
  empty: null,
  ok: null,
  dupe: { label: "DUPE", tone: "glow" },
  invalid: { label: "✗ LETTER", tone: "fog" },
  rejected: { label: "NOPE", tone: "lose" },
};
const ACCEPTED: { label: string; tone: Tone } = { label: "✓ OK", tone: "win" };
