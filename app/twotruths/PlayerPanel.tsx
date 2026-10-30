"use client";

import { useEffect, useState } from "react";
import { supabase, Room, Sub } from "@/lib/supabase";
import { BigBtn, PeekGuard } from "@/app/components/ui";
import { Dots } from "@/app/components/fx";
import { AUTHOR_POINTS_PER_FOOL, TTRound, TTPhaseData } from "@/app/twotruths/constants";

// Everything a player does in a round: write two truths and a lie on your
// turn, spot the lie on everyone else's. Shared by the phone view and the host
// screen, so whoever runs the room can play on the same device. `conceal`
// (host screen) puts the writing form behind a tap and hides which statement
// this seat voted for, since others can see that screen.
export function PlayerPanel({
  room,
  subs,
  playerId,
  conceal,
}: {
  room: Room;
  subs: Sub[];
  playerId: string;
  conceal?: boolean;
}) {
  const [statements, setStatements] = useState(["", "", ""]);
  const [lie, setLie] = useState<number | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    setStatements(["", "", ""]);
    setLie(null);
    setSent(false);
  }, [room.round_idx]);

  const rounds = (room.rounds ?? []) as TTRound[];
  const round = rounds[room.round_idx];
  const phaseData = (room.phase_data ?? {}) as TTPhaseData;
  const isAuthor = round?.author_id === playerId;
  const mySub = subs.find((s) => s.player_id === playerId && s.round_idx === room.round_idx);
  const locked = sent || !!mySub;
  const myVote = (mySub?.payload as { vote?: number } | undefined)?.vote;

  async function handIn() {
    if (locked) return;
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
    if (locked || isAuthor) return;
    setSent(true);
    const { error: e } = await supabase.from("arcade_subs").insert({
      room_id: room.id,
      player_id: playerId,
      round_idx: room.round_idx,
      payload: { vote: i },
    });
    if (e && e.code !== "23505") setSent(false);
  }

  if (!round) return null;

  if (room.phase === "write" && isAuthor && !locked) {
    const form = (
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
              className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3 py-3"
            />
            <button
              onClick={() => setLie(i)}
              className={`press rounded-lg px-3 py-3 text-sm font-bold border-2 ${
                lie === i ? "border-lose bg-lose/30 text-white" : "border-line text-fog"
              }`}
            >
              {lie === i ? "🤥 the lie" : "lie?"}
            </button>
          </div>
        ))}
        <BigBtn onClick={handIn} disabled={statements.some((s) => !s.trim()) || lie == null}>
          {lie == null ? "Mark which one is the lie" : "Send it"}
        </BigBtn>
      </div>
    );
    return conceal ? (
      <PeekGuard key={room.round_idx} label="Tap to write yours">
        {form}
      </PeekGuard>
    ) : (
      form
    );
  }

  if (room.phase === "write" && isAuthor)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-3xl">📨</p>
        <p className="font-bold text-xl">Sent! Keep a straight face.</p>
      </div>
    );

  if (room.phase === "write")
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-3xl">✍️</p>
        <p className="font-bold text-xl">
          {round.author_name} is writing
          <Dots />
        </p>
        <p className="text-fog text-sm">Get ready to spot the lie.</p>
      </div>
    );

  if (room.phase === "vote" && isAuthor)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <p className="text-3xl">😐</p>
        <p className="font-bold text-xl">They&apos;re deciding…</p>
        <p className="text-fog text-sm">
          +{AUTHOR_POINTS_PER_FOOL} for every player your lie fools.
        </p>
      </div>
    );

  if (room.phase === "vote")
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-extrabold text-center">
          Which one is {round.author_name}&apos;s lie?
        </h1>
        {(phaseData.statements ?? []).map((s, i) => (
          <button
            key={i}
            onClick={() => vote(i)}
            disabled={locked}
            className={`rounded-xl p-4 text-left font-semibold border-2 ${
              myVote === i && !conceal
                ? "border-glow bg-glow/20"
                : locked
                  ? "border-line opacity-50"
                  : "border-line bg-card press"
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
        {locked && (
          <p className="text-fog text-center text-sm">Locked in — waiting for the rest…</p>
        )}
      </div>
    );

  return null;
}
