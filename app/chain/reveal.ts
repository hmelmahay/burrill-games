// Reveal timings in ms, read by the host screen and the phones alike.
// - rowStep:  the full chain deals in one row at a time.
// - card:  the phone's own result, just after the host's Finish stamp.
// - board:  the leaderboard, once the last of the 10 rows has landed.
export const REVEAL = { rowStep: 60, card: 300, board: 900 } as const;
