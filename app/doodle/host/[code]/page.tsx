"use client";

import { useRef, useState, use, useEffect } from "react";
import { supabase } from "@/lib/supabase";
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
import { shuffle } from "@/lib/rooms";
import { guessMatches } from "@/lib/matching";
import { DoodleCanvas } from "@/app/doodle/DoodleCanvas";
import WORDS from "@/lib/content/doodle-words.json";
import {
  GUESS_POINTS,
  LATE_GUESS_POINTS,
  DRAWER_PER_CORRECT,
  DoodleRound,
  DoodleResult,
  DoodlePhaseData,
} from "@/app/doodle/constants";

type WordEntry = { w: string; d: string };

export default function DoodleHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("doodle", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);
  const correctOrderRef = useRef<string[]>([]);

  const settings = (room?.settings ?? {}) as { cycles?: number; drawSeconds?: number };
  const drawSeconds = settings.drawSeconds ?? 90;
  const rounds = (room?.rounds ?? []) as DoodleRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as DoodlePhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const drawerSub = roundSubs.find((s) => s.player_id === round?.drawer_id);
  const word = (drawerSub?.payload as { word?: string } | undefined)?.word;
  const guessers = players.filter((p) => p.id !== round?.drawer_id);

  const left = useCountdown(
    `${room?.round_idx}-${room?.phase}`,
    drawSeconds,
    room?.phase === "draw",
  );

  // Who has guessed the word, in order of getting it right.
  const correctSet = new Set<string>();
  if (word) {
    for (const s of roundSubs) {
      if (s.player_id === round?.drawer_id) continue;
      const guesses = (s.payload as { guesses?: string[] }).guesses ?? [];
      if (guesses.some((g) => guessMatches(g, word))) correctSet.add(s.player_id);
    }
  }
  useEffect(() => {
    for (const id of correctSet) {
      if (!correctOrderRef.current.includes(id)) correctOrderRef.current.push(id);
    }
  });

  async function startGame() {
    if (!room) return;
    setBusy(true);
    const cycles = settings.cycles ?? 1;
    const easy = shuffle((WORDS as WordEntry[]).filter((x) => x.d === "easy"));
    const hard = shuffle((WORDS as WordEntry[]).filter((x) => x.d === "hard"));
    const order: DoodleRound[] = [];
    let e = 0;
    let h = 0;
    for (let c = 0; c < cycles; c++) {
      for (const p of shuffle(players)) {
        order.push({
          drawer_id: p.id,
          drawer_name: p.name,
          options: [easy[e++ % easy.length].w, easy[e++ % easy.length].w, hard[h++ % hard.length].w],
        });
      }
    }
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "pick", round_idx: 0, rounds: order, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  // Drawer picked a word → open the drawing round.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "pick" || !word) return;
    const key = `draw-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    correctOrderRef.current = [];
    supabase
      .from("arcade_rooms")
      .update({ phase: "draw" })
      .eq("id", room.id)
      .then(({ error: e }) => {
        if (e) console.error("open drawing failed:", e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, word]);

  async function endRound() {
    if (!room || !round || room.phase !== "draw" || !word) return;
    const key = `score-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    setBusy(true);

    const order = correctOrderRef.current;
    const results: DoodleResult[] = players.map((p) => {
      if (p.id === round.drawer_id) {
        return {
          player_id: p.id,
          name: p.name,
          gained: correctSet.size * DRAWER_PER_CORRECT,
          correct: false,
          isDrawer: true,
        };
      }
      const idx = order.indexOf(p.id);
      const correct = correctSet.has(p.id);
      const gained = correct
        ? idx >= 0
          ? GUESS_POINTS[idx] ?? LATE_GUESS_POINTS
          : LATE_GUESS_POINTS
        : 0;
      return { player_id: p.id, name: p.name, gained, correct, isDrawer: false };
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
      .update({ phase: "reveal", phase_data: { word, results } })
      .eq("id", room.id);
    setBusy(false);
  }

  // Everyone got it → end the round automatically.
  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "draw" && guessers.length > 0 && correctSet.size >= guessers.length) {
      endRound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctSet.size, guessers.length, room?.phase]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= rounds.length;
    advancingRef.current = null;
    correctOrderRef.current = [];
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "pick", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Doodle Dash" icon="🎨"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Doodle Dash" icon="🎨"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    <Shell title="Doodle Dash · host" icon="🎨">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Doodle Dash → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <BigBtn onClick={startGame} disabled={busy || players.length < 3}>
            {players.length < 3
              ? "Need at least 3 players…"
              : `Start (${players.length * (settings.cycles ?? 1)} drawings)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "pick" && round && (
        <div className="flex flex-col gap-4 items-center py-10">
          <p className="text-sm text-fog">
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <p className="text-4xl">🖌️</p>
          <h1 className="text-2xl font-extrabold text-center">
            {round.drawer_name} is choosing a word…
          </h1>
          <BigBtn onClick={next} disabled={busy} color="ghost">
            Skip {round.drawer_name}
          </BigBtn>
        </div>
      )}

      {room.phase === "draw" && round && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm text-fog">
            <span>
              Round {room.round_idx + 1}/{rounds.length} · 🖌️ {round.drawer_name}
            </span>
            <span>
              {correctSet.size}/{guessers.length} got it
            </span>
          </div>
          <Countdown left={left} total={drawSeconds} />
          <DoodleCanvas code={code} roundIdx={room.round_idx} canDraw={false} />
          <div className="flex flex-wrap gap-1.5">
            {guessers.map((p) => (
              <span
                key={p.id}
                className={`rounded-full px-3 py-1 text-sm font-semibold border ${
                  correctSet.has(p.id)
                    ? "bg-win/20 border-win text-win"
                    : "border-line text-fog"
                }`}
              >
                {correctSet.has(p.id) ? "✓ " : ""}
                {p.name}
              </span>
            ))}
          </div>
          <BigBtn onClick={endRound} disabled={busy} color={left === 0 ? "glow" : "ghost"}>
            {left === 0 ? "Time! Score the round" : "End round early"}
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-card border-2 border-win p-5 text-center">
            <div className="text-fog text-sm">{round.drawer_name} was drawing</div>
            <div className="text-3xl font-extrabold uppercase tracking-wide">
              {phaseData.word}
            </div>
          </div>
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= rounds.length ? "Finish game" : "Next artist"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <a href="/doodle/host" className="underline text-fog">
            Play again with a new room
          </a>
        </div>
      )}
    </Shell>
  );
}
