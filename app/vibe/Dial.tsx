"use client";

// Shared by the host scoreboard and every player's phone, so everyone sees
// where each dial landed relative to the psychic's secret spot.
export const MARK_COLORS = ["#e21b3c", "#1368ce", "#d89e00", "#26890c", "#7c5cff", "#ff9f1c"];

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
