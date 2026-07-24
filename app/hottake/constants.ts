export const CROWD_POINTS = 200; // voted with the plurality
export const FAME_POINTS = 100; // got named by the room

export type HotTakeResult = {
  player_id: string;
  name: string;
  gained: number;
  target: string | null; // player_id they voted for
};
export type HotTakePhaseData = {
  counts?: Record<string, number>; // player_id -> votes received
  top?: string[]; // plurality player_id(s)
  results?: HotTakeResult[];
};
