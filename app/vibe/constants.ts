// Guesser points by distance from the hidden target (0-100 dial).
export function pointsForDistance(d: number): number {
  if (d <= 5) return 500;
  if (d <= 10) return 400;
  if (d <= 20) return 250;
  if (d <= 35) return 100;
  return 0;
}
export const PSYCHIC_PER_CLOSE = 150; // per guesser within 20
export const CLOSE_RANGE = 20;

export type VibeRound = {
  psychic_id: string;
  psychic_name: string;
  left: string;
  right: string;
  target: number; // 0-100, secret until reveal
};
export type VibeResult = {
  player_id: string;
  name: string;
  gained: number;
  guess: number | null;
  isPsychic: boolean;
};
export type VibePhaseData = {
  clue?: string; // published when guessing opens
  target?: number; // published at reveal
  results?: VibeResult[];
};
