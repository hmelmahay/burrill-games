// Closest guess wins. Ties on distance share the same rank points.
export const RANK_POINTS = [500, 300, 200];
export const PARTICIPATION_POINTS = 100;
export const EXACT_BONUS = 250;

export type BallparkResult = {
  player_id: string;
  name: string;
  gained: number;
  guess: number | null;
  distance: number | null;
};
export type BallparkPhaseData = {
  results?: BallparkResult[];
};
