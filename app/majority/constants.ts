export const PREDICT_POINTS = 500;
export const TIE_POINTS = 250;

export type MajorityResult = {
  player_id: string;
  name: string;
  gained: number;
  vote: "a" | "b" | null;
  pred: "a" | "b" | null;
};
export type MajorityPhaseData = {
  aCount?: number;
  bCount?: number;
  majority?: "a" | "b" | "tie";
  results?: MajorityResult[];
};
