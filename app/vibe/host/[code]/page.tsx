"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips } from "@/app/components/ui";
import { shuffle } from "@/lib/rooms";
import { Dial, MARK_COLORS } from "@/app/vibe/Dial";
import { PlayerPanel } from "@/app/vibe/PlayerPanel";
import { playerKey } from "@/lib/rooms";
import { addBot, removeBot, isBot, humansOf, botsOf, botSkill, botDialGuess, botPsychicSpot, botDelayMs } from "@/lib/bots";
import { useBotSubmissions } from "@/lib/useBots";
import { VIBE_SCALES } from "@/lib/content/vibes";
import { VIBE_CLUE_BANK } from "@/lib/content/vibe-clues";
import {
  pointsForDistance,
  PSYCHIC_PER_CLOSE,
  CLOSE_RANGE,
  VibeRound,
  VibeResult,
  VibePhaseData,
} from "@/app/vibe/constants";

export default function VibeHost({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("vibe", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);

  const [botErr, setBotErr] = useState<string | null>(null);
  // What the clue reader made of this round's clue. `pos: null` means the
  // reader was unavailable and the bots are falling back to peeking.
  const [clueRead, setClueRead] = useState<{ round: number; pos: number | null } | null>(null);
  // Set when whoever opened this screen also joined as a player.
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  useEffect(() => {
    setMyPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);
  const iAmPlaying = !!myPlayerId && players.some((p) => p.id === myPlayerId);
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
    const botScales = shuffle(VIBE_CLUE_BANK);
    const order: VibeRound[] = [];
    let si = 0;
    let bi = 0;
    for (let c = 0; c < cycles; c++) {
      // Everyone takes a turn as psychic, bots included — otherwise a solo
      // human only ever writes clues and never gets to guess.
      for (const p of shuffle(players)) {
        if (isBot(p)) {
          // Bots draw from the hand-written clue bank, and the secret spot is
          // placed inside the clue's zone so the clue is always truthful.
          const sc = botScales[bi++ % botScales.length];
          const { zone, target } = botPsychicSpot();
          const options = sc.zones[zone];
          order.push({
            psychic_id: p.id,
            psychic_name: p.name,
            left: sc.left,
            right: sc.right,
            target,
            botClue: options[Math.floor(Math.random() * options.length)],
          });
        } else {
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

  // Ask the server what the clue means, once per round, before any bot guesses.
  // Without this the bots would be reading round.target — i.e. cheating.
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "guess" || !round || !phaseData.clue) return;
    if (clueRead?.round === room.round_idx) return;
    let cancelled = false;
    fetch("/api/vibe/read-clue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clue: phaseData.clue, left: round.left, right: round.right }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return;
        const pos = typeof j?.position === "number" ? j.position : null;
        setClueRead({ round: room.round_idx, pos });
      })
      .catch(() => {
        if (!cancelled) setClueRead({ round: room.round_idx, pos: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.round_idx, room?.phase, phaseData.clue]);

  const readyToGuess = clueRead?.round === room?.round_idx;
  const readPos = readyToGuess ? clueRead?.pos : undefined;

  // A bot psychic files its clue after a humanlike pause, which trips the
  // existing "clue arrived → open guessing" effect below.
  const clueSentRef = useRef<string | null>(null);
  useEffect(() => {
    if (tvRef.current) return;
    if (!room || room.phase !== "clue" || !round?.botClue) return;
    if (psychicSub) return;
    const key = `clue-${room.id}-${room.round_idx}`;
    if (clueSentRef.current === key) return;
    clueSentRef.current = key;
    const t = setTimeout(() => {
      supabase
        .from("arcade_subs")
        .insert({
          room_id: room.id,
          player_id: round.psychic_id,
          round_idx: room.round_idx,
          payload: { clue: round.botClue },
        })
        .then(({ error: e }) => {
          if (e && e.code !== "23505") clueSentRef.current = null;
        });
    }, botDelayMs());
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.round_idx, room?.phase, round?.botClue, psychicSub?.id]);

  useBotSubmissions({
    room,
    players,
    roundSubs,
    active: room?.phase === "guess" && !!round && readyToGuess,
    tvRef,
    excludeId: round?.psychic_id,
    makePayload: (bot) => ({
      // readPos is the reader's interpretation of the clue; falling back to
      // round.target only happens when the reader is offline.
      guess: botDialGuess(readPos ?? round!.target, botSkill(bot.id)),
    }),
  });

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
  const revealMarks = (phaseData.results ?? [])
    .filter((r) => r.guess != null)
    .map((r, i) => ({ pos: r.guess!, label: r.name, color: MARK_COLORS[i % MARK_COLORS.length] }));

  return (
    <Shell title="Vibe Check · host" icon="🌡️">
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} game="vibe" />
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
            Bots take psychic turns too, so you get to guess as well as give
            clues. One round per player.
          </p>
          <BigBtn
            onClick={startGame}
            disabled={busy || players.length < 3 || humansOf(players).length < 1}
          >
            {players.length < 3
              ? "Need at least 3 players (bots count)…"
              : humansOf(players).length < 1
                ? "Need at least 1 human…"
                : `Start (${players.length * (settings.cycles ?? 1)} rounds)`}
          </BigBtn>
        </div>
      )}

      {iAmPlaying && myPlayerId && (room.phase === "clue" || room.phase === "guess") && (
        <div className="mb-5 rounded-2xl border-2 border-violet bg-card/60 p-4">
          <PlayerPanel room={room} players={players} subs={subs} playerId={myPlayerId} />
        </div>
      )}

      {room.phase === "clue" && round && !(iAmPlaying && round.psychic_id === myPlayerId) && (
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
          {readyToGuess && readPos == null && (
            <p className="text-lose text-center text-xs">
              Clue reader offline — bots are guessing from the answer this round.
            </p>
          )}
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
