"use client";

import { useEffect, useState, use } from "react";
import { QuizRound, Player } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import {
  CHOICE_COLORS,
  CHOICE_LETTERS,
  eliminatedChoices,
  QuizSettings,
  QuizPhaseData,
} from "@/app/quiz/constants";

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

export default function QuizStage({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();
  const { room, players, subs, error } = useRoom("quiz", code);

  const settings = (room?.settings ?? {}) as QuizSettings;
  const answerSeconds = settings.answerSeconds ?? 20;
  const totalQuestions = Math.min(settings.numQuestions ?? 10, room?.rounds.length ?? 0);
  const round = room ? (room.rounds[room.round_idx] as QuizRound | undefined) : undefined;
  const phaseData = (room?.phase_data ?? {}) as QuizPhaseData;

  const answeredIds = new Set(
    subs.filter((s) => s.round_idx === room?.round_idx).map((s) => s.player_id),
  );

  // Re-render 4×/second while a question runs so the clock and hint
  // strike-outs stay live; `left` itself is derived from the server timestamp.
  const questionLive = room?.phase === "question";
  const [, tick] = useState(0);
  useEffect(() => {
    if (!questionLive) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [questionLive]);

  const startMs = room?.phase_started_at ? new Date(room.phase_started_at).getTime() : null;
  const left =
    questionLive && startMs != null
      ? Math.max(
          0,
          Math.min(answerSeconds, answerSeconds - Math.floor((Date.now() - startMs) / 1000)),
        )
      : answerSeconds;
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
                  style={{ background: CHOICE_COLORS[i] }}
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

          <StageLeaderboard players={players} phaseData={phaseData} />
        </div>
      )}

      {room.phase === "gameover" && <Podium players={players} />}
    </Stage>
  );
}

// --- layout chrome ---

function Stage({ code, children }: { code?: string; children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col p-6 md:p-10 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4 text-fog">
        <span className="text-xl font-bold">⚡ Quiz Rush</span>
        {code && (
          <span className="text-xl">
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
        <div className="text-fog text-2xl uppercase tracking-[0.4em] mb-3">Join code</div>
        <div className="text-9xl font-extrabold font-mono tracking-[0.25em] text-glow">{code}</div>
        <p className="text-fog text-2xl mt-4">
          Grab your phone → Quiz Rush → Join · {totalQuestions} questions
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3 max-w-3xl">
        {players.map((p) => (
          <span
            key={p.id}
            className="pop-in rounded-full bg-card border-2 border-line px-6 py-3 text-2xl font-semibold"
          >
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

function StageClock({ left, total, overtime }: { left: number; total: number; overtime: boolean }) {
  const pct = total > 0 ? (left / total) * 100 : 0;
  return (
    <div className="flex items-center gap-5">
      <div className="flex-1 h-6 rounded-full bg-line overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${
            left <= 5 ? "bg-lose" : "bg-win"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono text-5xl font-extrabold w-28 text-right ${
          overtime ? "text-lose animate-pulse" : left <= 5 ? "text-lose" : ""
        }`}
      >
        {overtime ? "⏰" : `${left}s`}
      </span>
    </div>
  );
}

// Who's answered — names light up as submissions land, never which choice.
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
              key={p.id}
              className={`rounded-full px-4 py-1.5 text-lg font-semibold border-2 transition-all duration-300 ${
                done
                  ? "bg-win/20 border-win text-win"
                  : "bg-card border-line text-fog"
              }`}
            >
              {done ? "✓ " : ""}
              {p.name}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// --- reveal ---

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
              <div className="h-5 rounded-full bg-line overflow-hidden">
                <div
                  className={`h-full rounded-full grow-bar ${
                    isAnswer ? "bg-win" : "bg-fog/40"
                  }`}
                  style={{ width: `${(n / max) * 100}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-2xl font-bold w-24 text-right">
              {n} <span className="text-fog text-lg font-normal">/{players}</span>
            </span>
          </div>
        );
      })}
      {/* Bars sweep in on mount; width is inline so the sweep ends at the real value. */}
      <style>{`
        @keyframes growBar { from { width: 0; } }
        .grow-bar { animation: growBar 0.8s ease-out; }
      `}</style>
    </div>
  );
}

// pointsForElapsed is monotonic in speed, so the biggest gain among correct
// answers belongs to the fastest correct player.
function FastestCallout({ phaseData }: { phaseData: QuizPhaseData }) {
  const correct = (phaseData.results ?? []).filter((r) => r.correct);
  if (correct.length === 0) {
    return (
      <p className="text-center text-2xl text-fog">😱 Nobody got it!</p>
    );
  }
  const fastest = correct.reduce((a, b) => (b.gained > a.gained ? b : a));
  return (
    <p className="pop-in text-center text-3xl font-bold">
      ⚡ Fastest: <span className="text-glow">{fastest.name}</span>{" "}
      <span className="text-win">+{fastest.gained}</span>
    </p>
  );
}

function StageLeaderboard({
  players,
  phaseData,
}: {
  players: Player[];
  phaseData: QuizPhaseData;
}) {
  const gains: Record<string, number> = {};
  (phaseData.results ?? []).forEach((r) => (gains[r.player_id] = r.gained));
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <ol className="flex flex-col gap-2">
      {sorted.map((p, i) => (
        <li
          key={p.id}
          className="flex items-center gap-4 rounded-xl px-5 py-3 bg-card border border-line text-2xl"
        >
          <span className="w-10 text-center font-bold text-fog">
            {i === 0 ? "👑" : i + 1}
          </span>
          <span className="flex-1 font-semibold truncate">{p.name}</span>
          {gains[p.id] != null && gains[p.id] > 0 && (
            <span className="text-win font-bold pop-in">+{gains[p.id]}</span>
          )}
          <span className="font-mono font-bold w-24 text-right">{p.score}</span>
        </li>
      ))}
    </ol>
  );
}

// --- gameover ---

function Podium({ players }: { players: Player[] }) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  // Render order 2nd · 1st · 3rd so the podium has its classic silhouette.
  const order = [top[1], top[0], top[2]].filter(Boolean) as Player[];
  const heights: Record<string, string> = top[0]
    ? { [top[0].id]: "h-56", ...(top[1] ? { [top[1].id]: "h-40" } : {}), ...(top[2] ? { [top[2].id]: "h-28" } : {}) }
    : {};
  const medals: Record<string, string> = top[0]
    ? { [top[0].id]: "🥇", ...(top[1] ? { [top[1].id]: "🥈" } : {}), ...(top[2] ? { [top[2].id]: "🥉" } : {}) }
    : {};
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <h1 className="text-6xl font-extrabold">🏆 Final standings</h1>
      <div className="flex items-end justify-center gap-6 w-full max-w-3xl">
        {order.map((p) => (
          <div key={p.id} className="flex-1 flex flex-col items-center gap-3 pop-in">
            <span className="text-5xl">{medals[p.id]}</span>
            <span className="text-3xl font-extrabold text-center truncate max-w-full">
              {p.name}
            </span>
            <span className="font-mono text-2xl font-bold text-fog">{p.score}</span>
            <div
              className={`w-full rounded-t-2xl bg-card border-2 border-line border-b-0 ${
                heights[p.id] ?? "h-24"
              }`}
            />
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="flex flex-col gap-1.5 w-full max-w-xl">
          {rest.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-4 rounded-lg px-4 py-2 bg-card border border-line text-xl"
            >
              <span className="w-8 text-center font-bold text-fog">{i + 4}</span>
              <span className="flex-1 font-semibold truncate">{p.name}</span>
              <span className="font-mono font-bold">{p.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
