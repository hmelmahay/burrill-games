export const POINTS_PER_ANSWER = 100;

export type CellState = "ok" | "dupe" | "invalid" | "rejected" | "empty";
export type ScatterCell = { a: string; s: CellState };
export type ScatterResult = {
  player_id: string;
  name: string;
  gained: number;
  cells: ScatterCell[];
};
export type ScatterPhaseData = {
  results?: ScatterResult[];
};
