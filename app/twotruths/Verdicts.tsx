"use client";

import type { CSSProperties } from "react";
import { Reveal, Stamp } from "@/app/components/fx";
import type { TTResult } from "@/app/twotruths/constants";
import { verdictTimes } from "@/app/twotruths/reveal";

// The edge each verdict fades in over a card. They sit 2px out so they cover
// the card's own border. Literal colors, since TV browsers see this screen.
const EDGE: CSSProperties = { top: -2, right: -2, bottom: -2, left: -2 };
const TRUE_EDGE: CSSProperties = {
  ...EDGE,
  border: "2px solid rgba(46, 204, 113, 0.8)",
  background: "rgba(46, 204, 113, 0.07)",
};
const LIE_EDGE: CSSProperties = {
  ...EDGE,
  border: "2px solid #e74c3c",
  background: "rgba(231, 76, 60, 0.2)",
  boxShadow: "0 0 18px rgba(231, 76, 60, 0.45)",
};

// The reveal, on the host screen and (compact) on the phones. Every statement
// starts as the same plain card, so the first frame gives nothing away. The
// truths get their TRUE stamp first, in statement order, and the lie lands
// last with a red overlay, a big stamp and a shake. Who voted for each one
// fades in just after its verdict. Stamps never take layout space, and every
// card reserves the same room for one, so card sizes can't hint at the lie.
export function Verdicts({
  statements,
  lie,
  results,
  compact = false,
}: {
  statements: string[];
  lie?: number;
  results: TTResult[];
  compact?: boolean;
}) {
  const at = verdictTimes(statements.length, lie);
  return (
    // overflow-x-clip: a slamming stamp starts at twice its size and must not
    // widen a phone screen for that instant. -mx-4 px-4 moves the clip edge out
    // into the Shell's 16px padding, so the lie's glow isn't cut off at the
    // sides. Vertical overflow stays visible.
    <div className="-mx-4 flex flex-col gap-2 overflow-x-clip px-4">
      {statements.map((s, i) => {
        const isLie = i === lie;
        const voters = results.filter((r) => r.vote === i).map((r) => r.name);
        return (
          <div key={i} className="relative rounded-xl border-2 border-line bg-card">
            <Reveal
              kind="fade"
              delayMs={at[i]}
              className="pointer-events-none absolute rounded-xl"
              style={isLie ? LIE_EDGE : TRUE_EDGE}
            />
            <Reveal kind={isLie ? "shake" : "none"} delayMs={at[i]} className={`relative ${compact ? "p-3 text-sm" : "p-4"}`}>
              <p className="font-semibold break-words">
                <span className="text-fog">{i + 1}.</span> {s}
              </p>
              <div className={`mt-1 flex items-center gap-3 ${compact ? "min-h-8" : "min-h-11"}`}>
                <div className="min-w-0 flex-1">
                  {voters.length > 0 && (
                    <Reveal kind="fade" delayMs={200} as="p" className="text-xs text-fog break-words">
                      voted by {voters.join(", ")}
                    </Reveal>
                  )}
                </div>
                <div className={`relative shrink-0 self-stretch ${compact ? "w-24" : "w-40"}`}>
                  <span className="pointer-events-none absolute top-0 right-0 bottom-0 flex items-center">
                    {isLie ? (
                      <Stamp tone="lose" size={compact ? "md" : "lg"}>
                        🤥 Lie
                      </Stamp>
                    ) : (
                      <Stamp tone="win" size={compact ? "sm" : "md"}>
                        True
                      </Stamp>
                    )}
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        );
      })}
    </div>
  );
}
