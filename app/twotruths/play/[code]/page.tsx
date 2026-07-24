"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useRoom } from "@/lib/useRoom";
import { Shell, Leaderboard } from "@/app/components/ui";
import { playerKey } from "@/lib/rooms";
import { TTRound, TTPhaseData } from "@/app/twotruths/constants";

export default function TTPlay({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const { room, players, subs, error } = useRoom("twotruths", code);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [statements, setStatements] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setPlayerId(localStorage.getItem(playerKey(code)));
  }, [code]);

  useEffect(() => {
    setStatements(["", "", ""]);
    setLie(null);
    setSent(false);
  }, [room?.round_idx]);

  const rounds = (room?.rounds ?? []) as TTRound[];
  const round = room ? rounds[room.round_idx] : undefined;
  const phaseData = (room?.phase_data ?? {}) as TTPhaseData;
  const me = players.find((p) => p.id === playerId);
  const isAuthor = round?.author_id === playerId;
  const mySub = subs.find(
    (s) => s.player_id === playerId && s.round_idx === room?.round_idx,
  );
  const locked = sent || !!mySub;

  async function handIn() {
    if (!room || !playerId || locked) return;
    if (statements.some((s) => !s.trim()) || lie == null) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { statements: statements.map((s) => s.trim()), lie },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  async function vote(i: number) {
    if (!room || !playerId || locked || isAuthor) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { vote: i },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (error)
    return (
      <Shell title="Two Truths & a Lie" icon="🤥">
        <p className="text-lose">{error}</p>
        <Link className="underline" href="/twotruths/play">Back to join</Link>
      </Shell>
    );
  if (!room || !me)
    return (
      <Shell title="Two Truths & a Lie" icon="🤥">
        {room && !playerId ? (
          <p className="text-fog">
            No player on this device. <Link className="underline" href="/twotruths/play">Join first.</Link>
          </p>
        ) : (
          <p className="text-fog">Loading…</p>
        )}
      </Shell>
    );

  const myResult = (phaseData.results ?? []).find((r) => r.player_id === playerId);
  const myVote = (mySub?.payload as { vote?: number } | undefined)?.vote;

  return (
    <Shell title={`Two Truths & a Lie · ${me.name}`} icon="🤥">
      {room.phase === "lobby" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <p className="text-3xl">🎉</p>
          <h1 className="text-2xl font-extrabold">You&apos;re in, {me.name}!</h1>
          <p className="text-fog">Waiting for the host to start…</p>
          <p className="text-fog text-sm">{players.length} in the room</p>
        </div>
      )}

      {room.phase === "write" && round && isAuthor && !locked && (
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-extrabold text-center">
            Your turn! Two truths and a lie about you.
          </h1>
          {statements.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={s}
                onChange={(e) =>
                  setStatements((cur) => cur.map((v, j) => (j === i ? e.target.value : v)))
                }
                placeholder={`Statement ${i + 1}…`}
                maxLength={120}
                autoComplete="off"
                className="flex-1 rounded-xl border border-line bg-card px-3 py-3"
              />
              <button
                onClick={() => setLie(i)}
                className={`rounded-lg px-3 py-3 text-sm font-bold border-2 ${
                  lie === i
                    ? "border-lose bg-lose/30 text-white"
                    : "border-line text-fog"
                }`}
              >
                {lie === i ? "🤥 the lie" : "lie?"}
              </button>
            </div>
          ))}
          <button
            onClick={handIn}
            disabled={statements.some((s) => !s.trim()) || lie == null}
            className="rounded-xl bg-glow text-[#1a1000] py-4 font-bold text-lg disabled:opacity-40"
          >
            {lie == null ? "Mark which one is the lie" : "Send it"}
          </button>
        </div>
      )}

      {room.phase === "write" && round && isAuthor && locked && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">📨</p>
          <p className="font-bold text-xl">Sent! Keep a straight face.</p>
        </div>
      )}

      {room.phase === "write" && round && !isAuthor && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">✍️</p>
          <p className="font-bold text-xl">{round.author_name} is writing…</p>
          <p className="text-fog text-sm">Get ready to spot the lie.</p>
        </div>
      )}

      {room.phase === "vote" && round && isAuthor && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="text-3xl">😐</p>
          <p className="font-bold text-xl">They&apos;re deciding…</p>
          <p className="text-fog text-sm">
            +{250} for every player your lie fools.
          </p>
        </div>
      )}

      {room.phase === "vote" && round && !isAuthor && (
        <div className="flex flex-col gap-3">
          <h1 className="text-xl font-extrabold text-center">
            Which one is {round.author_name}&apos;s lie?
          </h1>
          {(phaseData.statements ?? []).map((s, i) => (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={locked}
              className={`rounded-xl p-4 text-left font-semibold border-2 transition ${
                myVote === i
                  ? "border-glow bg-glow/20"
                  : locked
                    ? "border-line opacity-50"
                    : "border-line bg-card active:scale-95"
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
          {locked && <p className="text-fog text-center text-sm">Locked in — waiting for the rest…</p>}
        </div>
      )}

      {room.phase === "reveal" && round && (
        <div className="flex flex-col gap-4">
          {myResult && (
            <div
              className={`rounded-2xl p-5 text-center pop-in ${
                myResult.gained > 0 ? "bg-win text-[#03180b]" : "bg-lose text-white"
              }`}
            >
              <div className="text-3xl font-extrabold">
                {myResult.gained > 0 ? `+${myResult.gained}` : "✗"}
              </div>
              <div className="font-semibold">
                {isAuthor
                  ? myResult.gained > 0
                    ? "Your lie fooled them!"
                    : "Nobody fell for it."
                  : myResult.correct
                    ? "You spotted the lie!"
                    : "Fooled!"}
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2">
            {(phaseData.statements ?? []).map((s, i) => (
              <div
                key={i}
                className={`rounded-xl p-3 text-sm font-semibold border ${
                  phaseData.lie === i ? "border-lose bg-lose/20" : "border-line bg-card"
                }`}
              >
                {phaseData.lie === i ? "🤥 " : "✅ "}
                {s}
              </div>
            ))}
          </div>
          <Leaderboard players={players} highlightId={playerId} />
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
