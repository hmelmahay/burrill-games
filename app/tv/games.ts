import type { GameKind } from "@/lib/supabase";
import { GAME_META } from "@/lib/games";

// Display names for the TV surfaces (entry page + legacy scoreboard), derived
// from the one registry. Same strings as before, e.g. "⚡ Quiz Rush".
export const GAME_NAMES = Object.fromEntries(
  (Object.keys(GAME_META) as (keyof typeof GAME_META)[])
    .filter((k) => k !== "needle")
    .map((k) => [k, `${GAME_META[k].icon} ${GAME_META[k].name}`]),
) as Record<GameKind, string>;
