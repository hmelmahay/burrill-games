// Reveal timing for Scatter Sprint, in ms after the reveal phase starts.  The
// host screen's leaderboard is the payoff and shows at once, with its points
// counting up from 200ms.  Each screen times its reveal from its own network
// arrival, so a phone's own result waits 250ms past the host's board, and the
// phone's board follows its card.
export const REVEAL = {
  phoneCard: 250, // the phone's result card slams in
  phoneBoard: 650, // the phone's leaderboard fades in, 400ms after its card
} as const;
