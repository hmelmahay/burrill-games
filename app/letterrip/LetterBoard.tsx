"use client";

import { LetterRound, Player } from "@/lib/supabase";
import { maskCells, slotPoints, NamedClaim, Claim } from "./constants";

// The shared board: the category up top, six answers below — first letter
// showing, a blank cell per hidden letter. A found tile flips to the full
// answer with who got it; `showAll` (reveal screens) opens everything.
export function LetterBoard({
  round,
  found,
  players,
  showAll = false,
  highlightId,
}: {
  round: LetterRound;
  found: (Claim | NamedClaim | null)[];
  players?: Player[];
  showAll?: boolean;
  highlightId?: string | null;
}) {
  const finderName = (c: Claim | NamedClaim) =>
    (c as NamedClaim).name ??
    players?.find((p) => p.id === c.player_id)?.name ??
    "?";
  return (
    <div className="flex flex-col gap-2">
      <p className="rounded-xl border-2 border-violet bg-violet/10 px-3 py-2 text-center font-bold">
        {round.cat}
      </p>
      {round.answers.map((ans, i) => {
        const claim = found[i] ?? null;
        const open = !!claim || showAll;
        const mine = claim?.player_id != null && claim.player_id === highlightId;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
              claim
                ? mine
                  ? "border-win bg-win/15 pop-in"
                  : "border-win/60 bg-card pop-in"
                : showAll
                  ? "border-line bg-card opacity-70"
                  : "border-line bg-card"
            }`}
          >
            <div className="flex flex-1 flex-wrap gap-x-3 gap-y-1">
              {maskCells(ans.a).map((word, w) => (
                <span key={w} className="flex gap-0.5">
                  {word.map((cell, c) => (
                    <span
                      key={c}
                      className={`flex h-7 w-5 items-center justify-center rounded font-mono font-bold ${
                        open
                          ? claim
                            ? "bg-win/20 text-win"
                            : "bg-line/60 text-fog"
                          : cell.shown
                            ? "bg-glow/20 text-glow"
                            : "border-b-2 border-fog/60 text-transparent"
                      }`}
                    >
                      {open || cell.shown ? cell.ch : "·"}
                    </span>
                  ))}
                </span>
              ))}
            </div>
            <span className="text-right text-xs font-semibold text-fog whitespace-nowrap">
              {claim ? (
                <>
                  {claim.ph === "steal" && "🔁 "}
                  {finderName(claim)}
                </>
              ) : (
                `${slotPoints(i)} pts`
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
