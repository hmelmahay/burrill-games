"use client";

import { useEffect, useState, use } from "react";
import { QuizRound, Player } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { useStaged } from "@/lib/motion";
import { Fuse, Leaderboard } from "@/app/components/ui";
import { Reveal, RevealScope, Stamp } from "@/app/components/fx";
import { Marquee, PlayerDot } from "@/app/components/brand";
import { FinalStandings } from "@/app/components/FinalStandings";
import {
  CHOICE_COLORS,
  CHOICE_LETTERS,
  eliminatedChoices,
  QuizSettings,
  QuizPhaseData,
} from "@/app/quiz/constants";
import { REVEAL, fastestCorrect } from "@/app/quiz/reveal";

// The stage screen: a big shared display (TV / iPad in common view) for a Quiz
// Rush room. Everyone answers on their phone; this screen shows the question,
// the clock, who's in, and the between-round drama. It is a pure spectator —
// it renders room state and never writes, so it can't race the host screen.
//
// The countdown here is anchored to the server-stamped phase_started_at, not a
// local timer: a stage opened mid-round shows the true remaining time, and it
// tracks the host's two-clock reveal deadline closely enough that "Time!"
// lands together on every screen.

const REVEAL_GRACE_SECONDS = 2; // matches the host's buzzer-beater grace
// The tile's bottom lip, as a literal inline shadow (same as the host tiles).
const LIP = "inset 0 -5px 0 rgba(0,0,0,.25)";

export default function QuizStage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const { room, players, subs, error } = useRoom("quiz", code);
  // Display only: a stage that joins late shows the final state, no replay.
  const staged = useStaged(room ? `${room.round_idx}:${room.phase}` : "", room?.phase_started_at);

  const settings = (room?.settings ?? {}) as QuizSettings;
  const answerSeconds = settings.answerSeconds ?? 20;
  const totalQuestions = Math.min(settings.numQuestions ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as QuizRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as QuizPhaseData;

  const answeredIds = new Set(
    subs.filter((s) => s.round_idx === room?.round_idx).map((s) => s.player_id),
  );

  // Re-render 4×/second while a clock is running (the question or a timed
  // reveal); `left` is derived from the server timestamp each render.
  const nextSeconds = settings.nextSeconds ?? 0;
  const questionLive = room?.phase === "question";
  const clockLive = questionLive || (room?.phase === "reveal" && nextSeconds > 0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!clockLive) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [clockLive]);

  const startMs = room?.phase_started_at ? new Date(room.phase_started_at).getTime() : null;
  const left =
    questionLive && startMs != null
      ? Math.max(
          0,
          Math.min(answerSeconds, answerSeconds - Math.floor((Date.now() - startMs) / 1000)),
        )
      : answerSeconds;
  const nextLeft =
    room?.phase === "reveal" && nextSeconds > 0 && startMs != null
      ? Math.max(
          0,
          Math.min(nextSeconds, nextSeconds - Math.floor((Date.now() - startMs) / 1000)),
        )
      : nextSeconds;
  const overtime =
    questionLive &&
    startMs != null &&
    Date.now() >= startMs + (answerSeconds + REVEAL_GRACE_SECONDS) * 1000;

  if (error) {
    return (
      <Stage>
        <p className="text-lose text-3xl text-center mt-24">{error}</p>
      </Stage>
    );
  }
  if (!room) {
    return (
      <Stage>
        <p className="text-fog text-3xl text-center mt-24">Loading…</p>
      </Stage>
    );
  }

  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));

  return (
    // The lobby already shows the code huge — no need to repeat it up top.
    <Stage code={room.phase === "lobby" ? undefined : room.code}>
      {room.phase === "lobby" && <StageLobby code={room.code} players={players} totalQuestions={totalQuestions} />}

      {room.phase === "question" && round && (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex items-baseline justify-between text-fog text-2xl">
            <span className="font-bold">
              Question {room.round_idx + 1}
              <span className="text-fog/60">/{totalQuestions}</span>
            </span>
            <span>{round.cat}</span>
          </div>

          <StageClock left={left} total={answerSeconds} overtime={overtime} />

          <h1 className="text-5xl md:text-6xl font-extrabold text-center leading-tight py-6 text-balance">
            {round.q}
          </h1>

          <div className="grid grid-cols-2 gap-4">
            {round.choices.map((c, i) => {
              const dead = settings.hints
                ? eliminatedChoices(room.round_idx, round.answer, left, answerSeconds).includes(i)
                : false;
              return (
                <div
                  key={i}
                  className={`rounded-2xl p-6 md:p-8 font-bold text-white text-2xl md:text-3xl flex items-center gap-4 transition-opacity duration-500 ${
                    dead ? "opacity-25 line-through" : ""
                  }`}
                  style={{ background: CHOICE_COLORS[i], boxShadow: LIP }}
                >
                  <span className="rounded-xl bg-black/25 px-4 py-2 font-mono">
                    {CHOICE_LETTERS[i]}
                  </span>
                  <span className="text-balance">{c}</span>
                </div>
              );
            })}
          </div>

          <AnsweredTicker players={players} answeredIds={answeredIds} />
        </div>
      )}

      {room.phase === "reveal" && round && (
        <RevealScope staged={staged}>
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex items-baseline justify-between text-fog text-2xl">
              <span className="font-bold">
                Question {room.round_idx + 1}
                <span className="text-fog/60">/{totalQuestions}</span>
              </span>
              <span>{round.cat}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-center leading-tight text-balance">
              {round.q}
            </h1>

            <RevealBars round={round} counts={phaseData.counts ?? []} players={players.length} />

            <FastestCallout phaseData={phaseData} />

            {/* The size="lg" board keeps its badges and gain chips at phone
                size, so scale those up here for a room reading a TV. */}
            <Reveal
              kind="fade"
              delayMs={REVEAL.board}
              className="[&_.gain-chip]:text-xl [&_.rank-badge]:text-base"
            >
              <Leaderboard players={players} gains={gains} size="lg" />
            </Reveal>

            {nextSeconds > 0 && (
              <div className="flex items-center gap-4 text-fog text-xl mt-auto">
                <span className="whitespace-nowrap">
                  {room.round_idx + 1 >= totalQuestions
                    ? "Final standings in"
                    : "Next question in"}
                </span>
                <Fuse left={nextLeft} total={nextSeconds} color="#7c5cff" className="h-2.5 flex-1" />
                <span className="font-mono text-2xl font-bold w-14 text-right tabular-nums">
                  {nextLeft}s
                </span>
              </div>
            )}
          </div>
        </RevealScope>
      )}

      {room.phase === "gameover" && (
        <div className="flex flex-1 flex-col justify-center">
          <FinalStandings players={players} size="stage" staged={staged} />
        </div>
      )}
    </Stage>
  );
}

// --- layout chrome ---

// `calm` stops every attract loop on this big screen (bulb chases, breathing
// rings); one-shot entrances and reveals still play once.
function Stage({ code, children }: { code?: string; children: React.ReactNode }) {
  return (
    <main className="calm flex flex-1 flex-col p-6 md:p-10 max-w-6xl mx-auto w-full">
      <div aria-hidden className="fx-floor" />
      <div className="flex items-center justify-between gap-4 mb-4 text-fog">
        <Marquee icon="⚡" title="Quiz Rush" size="lg" />
        {code && (
          <span className="text-xl whitespace-nowrap">
            Join code{" "}
            <span className="font-mono font-extrabold text-glow tracking-[0.2em]">{code}</span>
          </span>
        )}
      </div>
      {children}
    </main>
  );
}

function StageLobby({
  code,
  players,
  totalQuestions,
}: {
  code: string;
  players: Player[];
  totalQuestions: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
      <div>
        <div className="text-fog text-2xl uppercase tracking-[0.4em] mb-4">Join code</div>
        <div className="code-tiles text-8xl" role="img" aria-label={`Join code ${code.split("").join(" ")}`}>
          {code.split("").map((ch, i) => (
            <span key={i} aria-hidden className="code-tile" style={{ animationDelay: `${120 + i * 70}ms` }}>
              {ch}
            </span>
          ))}
        </div>
        <p className="text-fog text-2xl mt-6">
          Grab your phone → Quiz Rush → Join · {totalQuestions} questions
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 max-w-3xl">
        {players.map((p) => (
          <span key={p.id} className="token pop-in text-2xl py-1.5 pr-5">
            <PlayerDot id={p.id} name={p.name} size="lg" />
            {p.name}
          </span>
        ))}
        {players.length === 0 && (
          <span className="text-fog text-2xl">Waiting for players to join…</span>
        )}
      </div>
    </div>
  );
}

// Same colors as the phones' Countdown: green, orange at 10s, red at 5s. The
// number ticks once a second from 5 to 1; overtime gets a one-shot stamp.
function StageClock({ left, total, overtime }: { left: number; total: number; overtime: boolean }) {
  const color = left <= 5 ? "#e74c3c" : left <= 10 ? "#ff9f1c" : "#2ecc71";
  return (
    <div className="flex items-center gap-5">
      <Fuse left={left} total={total} color={color} className="h-6 flex-1" />
      {overtime ? (
        <Stamp tone="lose" size="lg">
          Time!
        </Stamp>
      ) : (
        <span
          className={`font-mono text-5xl font-extrabold w-28 text-right tabular-nums ${
            left <= 5 ? "text-lose" : ""
          }`}
        >
          <span key={left <= 5 ? left : "n"} className={left <= 5 && left > 0 ? "fx-tick" : ""}>
            {left}s
          </span>
        </span>
      )}
    </div>
  );
}

// Who's answered: names light up as submissions land, never which choice.
function AnsweredTicker({
  players,
  answeredIds,
}: {
  players: Player[];
  answeredIds: Set<string>;
}) {
  return (
    <div className="mt-auto">
      <div className="text-fog text-xl mb-2 text-center">
        {answeredIds.size}/{players.length} answered
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {players.map((p) => {
          const done = answeredIds.has(p.id);
          return (
            <span
              key={`${p.id}-${done ? 1 : 0}`}
              className={`token text-lg ${done ? "is-done pop-in" : "text-fog"}`}
            >
              <PlayerDot id={p.id} name={p.name} />
              {p.name}
              {done ? " ✓" : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// --- reveal ---

// Bars grow from zero, one after another; at rest (or on a late screen) they
// simply sit at their final width. Literal colors for older TV browsers.
function RevealBars({
  round,
  counts,
  players,
}: {
  round: QuizRound;
  counts: number[];
  players: number;
}) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex flex-col gap-3">
      {round.choices.map((c, i) => {
        const n = counts[i] ?? 0;
        const isAnswer = i === round.answer;
        return (
          <div key={i} className="flex items-center gap-4">
            <span
              className={`rounded-xl px-4 py-2 font-mono font-bold text-white text-2xl ${
                isAnswer ? "" : "opacity-40"
              }`}
              style={{ background: CHOICE_COLORS[i] }}
            >
              {CHOICE_LETTERS[i]}
            </span>
            <div className="flex-1">
              <div
                className={`text-xl md:text-2xl font-bold mb-1 ${
                  isAnswer ? "" : "text-fog"
                }`}
              >
                {isAnswer ? "✅ " : ""}
                {c}
              </div>
              <div className="vote-track h-5">
                <Reveal
                  kind="bar-x"
                  delayMs={i * 120}
                  className="vote-fill"
                  style={{
                    width: `${(n / max) * 100}%`,
                    background: isAnswer ? "#2ecc71" : "rgba(154,160,200,.4)",
                  }}
                />
              </div>
            </div>
            <span className="font-mono text-2xl font-bold w-24 text-right">
              {n} <span className="text-fog text-lg font-normal">/{players}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// Lands at the same beat as the host's callout.
function FastestCallout({ phaseData }: { phaseData: QuizPhaseData }) {
  const fastest = fastestCorrect(phaseData.results);
  return (
    <Reveal kind="fade" delayMs={REVEAL.fastest}>
      {fastest ? (
        <p className="text-center text-3xl font-bold">
          ⚡ <Stamp tone="gold" size="lg">Fastest</Stamp>{" "}
          <span className="text-glow">{fastest.name}</span>{" "}
          <span className="text-win">+{fastest.gained.toLocaleString()}</span>
        </p>
      ) : (
        <p className="text-center text-2xl text-fog">😱 Nobody got it!</p>
      )}
    </Reveal>
  );
}
