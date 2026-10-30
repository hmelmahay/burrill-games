"use client";

import { useRef } from "react";
import type { Player } from "@/lib/supabase";
import { PlayerDot } from "@/app/components/brand";
import { Stamp } from "@/app/components/fx";
import { useFlip } from "@/lib/motion";
import { HIDDEN_WORDS } from "./constants";

export type RaceRow = { p: Player; solved: number; done: boolean };

// The host's live race board, most words first:  a light comes on for each
// solved word, rows slide when someone overtakes, and the leader gets the gold
// edge.  It shows counts only, never the words, so it's safe on a TV.
export function RaceBoard({ rows }: { rows: RaceRow[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  useFlip(listRef, rows.map((r) => r.p.id).join(","));
  return (
    <ol ref={listRef} className="flex flex-col gap-1.5">
      {rows.map(({ p, solved, done }, i) => (
        <li
          key={p.id}
          data-flip-id={p.id}
          className={`hiscore-row gap-3 ${i === 0 && solved > 0 ? "is-leader" : ""}`}
        >
          <PlayerDot id={p.id} name={p.name} size="sm" />
          <span className="min-w-0 flex-1 truncate font-semibold">{p.name}</span>
          <span aria-hidden className="flex shrink-0 gap-1">
            {Array.from({ length: HIDDEN_WORDS }, (_, k) => (
              <span key={k} className={`led ${k < solved ? "on" : ""}`} />
            ))}
          </span>
          <span className="min-w-10 shrink-0 text-right">
            {done ? (
              <Stamp tone="win" size="sm">
                Finish
              </Stamp>
            ) : (
              <span className="font-mono text-sm tabular-nums">
                {solved}/{HIDDEN_WORDS}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
