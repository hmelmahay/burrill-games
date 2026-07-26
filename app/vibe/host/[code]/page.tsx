"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips } from "@/app/components/ui";
import { shuffle } from "@/lib/rooms";
import { addBot, removeBot, humansOf, botsOf, botSkill, botDelayMs, botDialGuess } from "@/lib/bots";
import { VIBE_SCALES } from "@/lib/content/vibes";
import {
  pointsForDistance,
  PSYCHIC_PER_CLOSE,
  CLOSE_RANGE,
  VibeRound,
  VibeResult,
  VibePhaseData,
} from "@/app/vibe/constants";

export function Dial({
  marks,
  target,
  left,
  right,
}: {
  marks: { pos: number; label: string; color: string }[];
  target?: number;
  left: string;
  right: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="relative h-24 rounded-xl bg-gradient-to-r from-violet/50 via-card to-glow/50 border border-line overflow-visible">
        {target != null && (
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-win rounded"
            style={{ left: `calc(${target}% - 3px)` }}
          />
        )}
        {marks.map((m, i) => (
          <div
            key={i}
            className="absolute flex flex-col items-center"
            style={{ left: `${m.pos}%`, top: `${8 + (i % 3) * 26}px`, transform: "translateX(-50%)" }}
          >
            <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: m.color }} />
            <span className="text-[10px] font-bold whitespace-nowrap">{m.label}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-sm font-bold">
        <span>← {left}</span>
        <span>{right} →</span>
      </div>
    </div>
  );
}

export default function VibeHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("vibe", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);

  const [botErr, setBotErr] = useState<string | null>(null);
  const botSubKeys = useRef(new Set<string>());
  const settings = (room?.settings ?? {}) as { cycles?: number };
  const rounds = (room?.rounds ?? []) as VibeRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as VibePhaseData;
  const roundSubs = subs.filter((s) => s.round_idx === room?.round_idx);
  const psychicSub = roundSubs.find((s) => s.player_id === round?.psychic_id);
  const guesses = roundSubs.filter((s) => s.player_id !== round?.psychic_id);
  const guesserCount = Math.max(0, players.length - 1);

  async function startGame() {
    if (!room) return;
    setBusy(true);
    const cycles = settings.cycles ?? 1;
    const scales = shuffle(VIBE_SCALES);
    const order: VibeRound[] = [];
    let si = 0;
    for (let c = 0; c < cycles; c++) {
      // Bots guess but never take the psychic seat — clues need a human.
      for (const p of shuffle(humansOf(players))) {
        const sc = scales[si++ % scales.length];
        order.push({
          psychic_id: p.id,
          psychic_name: p.name,
          left: sc.left,
          right: sc.right,
          target: 5 + Math.floor(Math.random() * 91), // 5..95
        });
      }
    }
    await supabase
      .from("arcade_rooms")
      .update({ status: "playing", phase: "clue", round_idx: 0, rounds: order, phase_data: {} })
      .eq("id", room.id);
    setBusy(false);
  }

  // Psychic sent a clue → open guessing.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "clue" || !psychicSub) return;
    const key = `guess-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    const clue = (psychicSub.payload as { clue?: string }).clue ?? "";
    supabase
      .from("arcade_rooms")
      .update({ phase: "guess", phase_data: { clue } })
      .eq("id", room.id)
      .then(({ error: e }) => {
        if (e) console.error("open guessing failed:", e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psychicSub?.id, room?.phase]);

  // Bot brains: during guessing, each bot without a dial in yet slides one
  // after a humanlike pause. Runs only on the real host tab (not /tv), and
  // re-arms safely after a refresh because it keys off missing subs.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "guess" || !round) return;
    const keys = botSubKeys.current;
    const timers: { t: ReturnType<typeof setTimeout>; key: string; fired: boolean }[] = [];
    for (const bot of botsOf(players)) {
      if (bot.id === round.psychic_id) continue;
      if (roundSubs.some((s) => s.player_id === bot.id)) continue;
      const key = `${room.round_idx}-${bot.id}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const entry = {
        key,
        fired: false,
        t: setTimeout(() => {
          entry.fired = true;
          supabase
            .from("arcade_subs")
            .insert({
              room_id: room.id,
              player_id: bot.id,
              round_idx: room.round_idx,
              payload: { guess: botDialGuess(round.target, botSkill(bot.id)) },
            })
            .then(({ error: e }) => {
              // 23505 = already submitted (double-fire race) — harmless.
              if (e && e.code !== "23505") keys.delete(key);
            });
        }, botDelayMs()),
      };
      timers.push(entry);
    }
    return () =>
      timers.forEach((e) => {
        clearTimeout(e.t);
        // Release unfired keys so a re-render reschedules instead of stranding the bot.
        if (!e.fired) keys.delete(e.key);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.round_idx, players.length, roundSubs.length]);

  async function reveal() {
    if (!room || !round || room.phase !== "guess") return;
    const key = `reveal-${room.round_idx}`;
    if (advancingRef.current === key) return;
    advancingRef.current = key;
    setBusy(true);

    let close = 0;
    const results: VibeResult[] = players.map((p) => {
      if (p.id === round.psychic_id) {
        return { player_id: p.id, name: p.name, gained: 0, guess: null, isPsychic: true };
      }
      const sub = guesses.find((s) => s.player_id === p.id);
      const g = (sub?.payload as { guess?: number } | undefined)?.guess;
      const guess = typeof g === "number" ? g : null;
      let gained = 0;
      if (guess != null) {
        const d = Math.abs(guess - round.target);
        gained = pointsForDistance(d);
        if (d <= CLOSE_RANGE) close++;
      }
      return { player_id: p.id, name: p.name, gained, guess, isPsychic: false };
    });
    const psychicResult = results.find((r) => r.isPsychic);
    if (psychicResult) psychicResult.gained = close * PSYCHIC_PER_CLOSE;

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
      .update({
        phase: "reveal",
        phase_data: { clue: phaseData.clue, target: round.target, results },
      })
      .eq("id", room.id);
    setBusy(false);
  }

  useEffect(() => {
    if (tvRef.current) return;
    if (room?.phase === "guess" && guesserCount > 0 && guesses.length >= guesserCount) {
      reveal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guesses.length, guesserCount, room?.phase]);

  async function next() {
    if (!room) return;
    setBusy(true);
    const isLast = room.round_idx + 1 >= rounds.length;
    advancingRef.current = null;
    await supabase
      .from("arcade_rooms")
      .update(
        isLast
          ? { phase: "gameover", status: "ended" }
          : { phase: "clue", round_idx: room.round_idx + 1, phase_data: {} },
      )
      .eq("id", room.id);
    setBusy(false);
  }

  if (error) return <Shell title="Vibe Check" icon="🌡️"><p className="text-lose">{error}</p></Shell>;
  if (!room) return <Shell title="Vibe Check" icon="🌡️"><p className="text-fog">Loading…</p></Shell>;

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const markColors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#7c5cff", "#ff9f1c"];
  const revealMarks = (phaseData.results ?? [])
    .filter((r) => r.guess != null)
    .map((r, i) => ({ pos: r.guess!, label: r.name, color: markColors[i % markColors.length] }));

  return (
    <Shell title="Vibe Check · host" icon="🌡️">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <p className="text-center text-fog text-sm">
            Players join at this site → Vibe Check → Join, with the code.
          </p>
          <div>
            <h2 className="font-bold mb-2">Players ({players.length})</h2>
            <PlayerChips players={players} />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={async () => setBotErr(room ? await addBot(room, players) : null)}
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
          {botErr && <p className="text-lose text-sm text-center">{botErr}</p>}
          <p className="text-fog text-xs text-center">
            Bots slide dials but never take the psychic seat — rounds rotate
            through the humans only.
          </p>
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 3 || humansOf(players).length < 1}
          >
            {players.length < 3
              ? "Need at least 3 players (bots count)…"
              : humansOf(players).length < 1
                ? "Need at least 1 human…"
                : `Start (${humansOf(players).length * (settings.cycles ?? 1)} rounds)`}
          </BigBtn>
        </div>
      )}

      {room.phase === "clue" && round && (
        <div className="flex flex-col gap-4 items-center py-8">
          <p className="text-sm text-fog">
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <p className="text-4xl">🔮</p>
          <h1 className="text-2xl font-extrabold text-center">
            {round.psychic_name} is tuning in…
          </h1>
          <div className="w-full max-w-md flex justify-between text-lg font-bold">
            <span>← {round.left}</span>
            <span>{round.right} →</span>
          </div>
          <p className="text-fog text-sm text-center">
            They can see the secret spot on this scale and are writing a clue.
          </p>
          <BigBtn onClick={next} disabled={busy} color="ghost">
            Skip {round.psychic_name}
          </BigBtn>
        </div>
      )}

      {room.phase === "guess" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length} · {guesses.length}/{guesserCount} dials set
          </p>
          <div className="rounded-2xl bg-card border-2 border-glow p-5 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">
              {round.psychic_name}&apos;s clue
            </div>
            <div className="text-2xl font-extrabold">“{phaseData.clue}”</div>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>← {round.left}</span>
            <span>{round.right} →</span>
          </div>
          <p className="text-fog text-center text-sm">
            Slide your dial to where that clue lives on the scale.
          </p>
          <BigBtn onClick={reveal} disabled={busy || guesses.length === 0} color="ghost">
            Reveal now ({guesses.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-fog text-center">
            Round {room.round_idx + 1}/{rounds.length} · clue: “{phaseData.clue}”
          </p>
          <Dial
            marks={revealMarks}
            target={phaseData.target}
            left={round.left}
            right={round.right}
          />
          <p className="text-center text-sm text-fog">
            The green line is where {round.psychic_name} was pointing ({phaseData.target}).
          </p>
          <Leaderboard players={players} gains={gains} />
          <BigBtn onClick={next} disabled={busy}>
            {room.round_idx + 1 >= rounds.length ? "Finish game" : "Next psychic"}
          </BigBtn>
        </div>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-col gap-5 items-center">
          <h1 className="text-4xl font-extrabold">🏆 Final standings</h1>
          <div className="w-full">
            <Leaderboard players={players} />
          </div>
          <Link href="/vibe/host" className="underline text-fog">
            Play again with a new room
          </Link>
        </div>
      )}
    </Shell>
  );
}
