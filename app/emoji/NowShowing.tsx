"use client";

import { Marquee } from "@/app/components/brand";
import { Reveal } from "@/app/components/fx";
import { useRevealTiming } from "@/lib/motion";
import { REVEAL } from "@/app/emoji/reveal";

// The puzzle as a movie screen: a "Now showing" sign, the emoji and a ticket
// chip with the kind. Shared by the host screen and the phones. Nothing here
// delays the puzzle, because a seated host guesses on this screen for speed
// points. Pass `answer` on the reveal: letterbox bars close in and the title
// lights up at REVEAL.title. A screen that missed the moment (not staged) shows
// the bars already in place.
export function NowShowing({
  emoji,
  kind,
  answer,
  compact = false,
}: {
  emoji: string;
  kind: string;
  answer?: string;
  compact?: boolean;
}) {
  const { staged } = useRevealTiming();
  const barStyle = staged ? undefined : { animation: "none" };
  return (
    <div className={`neon-panel relative overflow-hidden text-center ${compact ? "p-6" : "p-8"}`}>
      {answer !== undefined && (
        <>
          <Reveal kind="none" as="span" className="fx-letterbox lb-top" style={barStyle} />
          <Reveal kind="none" as="span" className="fx-letterbox lb-bottom" style={barStyle} />
        </>
      )}
      {/* Positioned and after the bars, so the sign and ticket sit on top of them. */}
      <div className="relative flex flex-col items-center gap-3">
        <Marquee title="Now showing" />
        <div className={`${compact ? "text-5xl" : "text-6xl"} leading-tight tracking-wider`}>{emoji}</div>
        {answer !== undefined && (
          <Reveal
            kind="neon-on"
            delayMs={REVEAL.title}
            className="neon-text text-3xl font-extrabold max-w-full break-words"
          >
            {answer}
          </Reveal>
        )}
        <span className="rounded-full border border-line bg-ink px-3 py-1 text-sm font-semibold text-fog">
          🎟️ {kind}
        </span>
      </div>
    </div>
  );
}
