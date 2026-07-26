import { Cell, Pattern } from "./types";
import { shuffle } from "./parsers";

// Build one 5x5 card. 24 random songs from the pool, free center at index 12.
export function generateCard(
  pool: { youtube_id: string; name: string }[],
): Cell[] {
  const picks = shuffle(pool).slice(0, 24);
  const grid: Cell[] = [];
  let pi = 0;
  for (let i = 0; i < 25; i++) {
    if (i === 12) grid.push({ free: true });
    else grid.push({ youtube_id: picks[pi].youtube_id, name: picks[pi++].name });
  }
  return grid;
}

export function isCovered(cell: Cell, called: string[]): boolean {
  if ("free" in cell) return true;
  return called.includes(cell.youtube_id);
}

const LINES: number[][] = (() => {
  const rows = [0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4].map((c) => r * 5 + c));
  const cols = [0, 1, 2, 3, 4].map((c) => [0, 1, 2, 3, 4].map((r) => r * 5 + c));
  const diag1 = [0, 6, 12, 18, 24];
  const diag2 = [4, 8, 12, 16, 20];
  return [...rows, ...cols, diag1, diag2];
})();

export function checkWin(
  grid: Cell[],
  called: string[],
  pattern: Pattern,
): boolean {
  const covered = grid.map((c) => isCovered(c, called));
  if (pattern === "blackout") return covered.every(Boolean);
  if (pattern === "fourcorners")
    return [0, 4, 20, 24].every((i) => covered[i]);
  // line
  return LINES.some((line) => line.every((i) => covered[i]));
}
