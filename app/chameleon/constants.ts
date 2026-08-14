// Official Chameleon scoring: slip away undetected = 2 for the chameleon;
// caught but guess the secret word = 1 for the chameleon; caught and miss
// = 2 for everyone else. A tied vote means the room couldn't agree, and the
// chameleon escapes.
export const ESCAPE_POINTS = 2;
export const CAUGHT_BUT_GUESSED_POINTS = 1;
export const CATCHERS_POINTS = 2;

export type ChamRound = {
  chameleon_id: string;
  chameleon_name: string;
  topic: string;
  words: string[]; // the 16-word card, shown to everyone
  secret_idx: number; // highlighted for everyone EXCEPT the chameleon
  order: string[]; // speaking order for the out-loud clues
};

export type ChamResult = {
  player_id: string;
  name: string;
  gained: number;
  wasChameleon: boolean;
};

export type ChamPhaseData = {
  votes?: Record<string, number>; // player_id -> votes received, published at tally
  accused_id?: string | null; // top of the vote, null on a tie
  caught?: boolean;
  guess_idx?: number | null; // the caught chameleon's word pick
  results?: ChamResult[];
};
