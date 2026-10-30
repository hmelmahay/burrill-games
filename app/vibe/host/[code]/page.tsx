"use client";

import { useRef, useState, use, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useSpectator } from "@/lib/useSpectator";
import { Shell, CodeBadge, BigBtn, Leaderboard, PlayerChips, HostSeatCard } from "@/app/components/ui";
import { LockInRow, Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { Confetti } from "@/app/components/Confetti";
import { FinalStandings } from "@/app/components/FinalStandings";
import { playerHue } from "@/lib/fx";
import { useStaged } from "@/lib/motion";
import { shuffle } from "@/lib/rooms";
import { Dial } from "@/app/vibe/Dial";
import { PlayerPanel } from "@/app/vibe/PlayerPanel";
import { BULLSEYE, EDGE_CLIP, REVEAL } from "@/app/vibe/reveal";
import { useHostSeat } from "@/lib/useHostSeat";
import { addBot, removeBot, isBot, humansOf, botsOf, botSkill, botDialGuess, botBlindDial, botPsychicSpot, botDelayMs } from "@/lib/bots";
import { useBotSubmissions } from "@/lib/useBots";
import { useBotAnswer } from "@/lib/useBotAnswer";
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
  const { room, players, subs, error, refresh, playersLoaded } = useRoom("vibe", code);
  const { tvRef } = useSpectator();
  const [busy, setBusy] = useState(false);
  const advancingRef = useRef<string | null>(null);

  const [botErr, setBotErr] = useState<string | null>(null);
  // Set when whoever opened this screen also joined as a player.
  const seat = useHostSeat("vibe", code, players, refresh, playersLoaded);
  // Display only: should this screen play the reveal, or show its end state?
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);
  const myPlayerId = seat.playerId;
  const iAmPlaying = seat.canPlay;
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
    // Only for this round: if a Skip already moved the room on, this must not
    // open the next round's guessing with this round's clue.
    supabase
      .from("arcade_rooms")
      .update({ phase: "guess", phase_data: { clue } })
      .eq("id", room.id)
      .eq("round_idx", room.round_idx)
      .eq("phase", "clue")
      .then(({ error: e }) => {
        if (e) console.error("open guessing failed:", e.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [psychicSub?.id, room?.phase]);

  // Bots read the clue like any player would — they are never given the
  // secret target. No reading available means they guess blind, not peek.
  const { ready: readyToGuess, answer: clueRead } = useBotAnswer<{ position: number }>({
    room,
    active: room?.phase === "guess" && !!round && !!phaseData.clue,
    tvRef,
    ask:
      room?.phase === "guess" && round && phaseData.clue
        ? { kind: "vibe", clue: phaseData.clue, left: round.left, right: round.right }
        : null,
  });

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
      guess:
        clueRead
          ? botDialGuess(clueRead.position, botSkill(bot.id))
          : botBlindDial(),
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
  // Each dial in its player's own color, the same as their dot everywhere else.
  const revealMarks = (phaseData.results ?? [])
    .filter((r) => r.guess != null)
    .map((r) => ({ id: r.player_id, pos: r.guess!, label: r.name, color: playerHue(r.player_id) }));
  const target = phaseData.target;
  const bullseye = target != null && revealMarks.some((m) => Math.abs(m.pos - target) <= BULLSEYE);
  const guessers = players.filter((p) => p.id !== round?.psychic_id);
  const canStart = players.length >= 3 && humansOf(players).length >= 1;

  return (
    <Shell title="Vibe Check · host" icon="🌡️" attractKey={room.phase === "lobby" ? players.length : undefined}>
      {room.phase === "lobby" && (
        <div className="flex flex-col gap-5">
          <CodeBadge code={room.code} />
          <HostSeatCard seat={seat} />
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
          <BigBtn onClick={startGame} disabled={busy || !canStart} attention={canStart}>
            {players.length < 3
              ? "Need at least 3 players (bots count)…"
              : humansOf(players).length < 1
                ? "Need at least 1 human…"
                : `Start (${players.length * (settings.cycles ?? 1)} rounds)`}
          </BigBtn>
        </div>
      )}

      {/* While someone else writes their clue there's nothing for this seat to do. */}
      {iAmPlaying &&
        myPlayerId &&
        (room.phase === "guess" ||
          (room.phase === "clue" && round?.psychic_id === myPlayerId)) && (
        <div className="mb-5 rounded-2xl border-2 border-violet bg-card/60 p-4">
          <PlayerPanel room={room} players={players} subs={subs} playerId={myPlayerId} conceal />
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
          <div className="w-full max-w-md">
            <Dial marks={[]} left={round.left} right={round.right} />
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
            Round {room.round_idx + 1}/{rounds.length}
          </p>
          <div className="neon-panel p-5 text-center">
            <div className="text-fog text-xs uppercase tracking-widest">
              {round.psychic_name}&apos;s clue
            </div>
            <div className="text-2xl font-extrabold">“{phaseData.clue}”</div>
          </div>
          <Dial marks={[]} left={round.left} right={round.right} />
          <LockInRow players={guessers} doneIds={guesses.map((s) => s.player_id)} label="dials set" />
          <p className="text-fog text-center text-sm">
            Slide your dial to where that clue lives on the scale.
          </p>
          {readyToGuess && !clueRead && (
            <p className="text-lose text-center text-xs">
              Bots are guessing blind this round — the answer service is
              unavailable, so they can&apos;t read the clue.
            </p>
          )}
          <BigBtn onClick={reveal} disabled={busy || guesses.length === 0} color="ghost">
            Reveal now ({guesses.length} in)
          </BigBtn>
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-col gap-4" style={EDGE_CLIP}>
            <p className="text-sm text-fog text-center">
              Round {room.round_idx + 1}/{rounds.length} · clue: “{phaseData.clue}”
            </p>
            <Dial marks={revealMarks} target={target} left={round.left} right={round.right} />
            <Reveal kind="fade" delayMs={REVEAL.target}>
              <p className="text-center text-sm text-fog">
                The green line is where {round.psychic_name} was pointing ({target}).
              </p>
            </Reveal>
            {bullseye && (
              <div className="flex justify-center">
                <Stamp tone="gold" size="lg" delayMs={REVEAL.bullseye}>
                  Bullseye
                </Stamp>
                <Confetti delayMs={REVEAL.bullseye} />
              </div>
            )}
            <Reveal kind="fade" delayMs={REVEAL.board}>
              <Leaderboard players={players} gains={gains} highlightId={myPlayerId} />
            </Reveal>
            <BigBtn onClick={next} disabled={busy}>
              {room.round_idx + 1 >= rounds.length ? "Finish game" : "Next psychic"}
            </BigBtn>
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <div style={EDGE_CLIP}>
          <FinalStandings players={players} highlightId={myPlayerId} size="host" staged={staged}>
            <Link href="/vibe/host" className="tv-hide underline text-fog">
              Play again with a new room
            </Link>
          </FinalStandings>
        </div>
      )}
    </Shell>
  );
}
