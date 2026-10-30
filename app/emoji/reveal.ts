// Reveal timing for Emoji Cinema, in ms after the reveal phase starts. The host
// screen and the phones both read these.  Each screen times its reveal from its
// own network arrival, so a phone's own result card waits 250ms past the title
// lighting up on the big screen, and the phone's board follows its card.
export const REVEAL = {
  title: 250, // the answer lights up (host and phone)
  list: 400, // host: everyone's guesses rise in, 60ms apart
  board: 600, // host: the leaderboard fades in and counts up
  phoneCard: 500, // phone: its result card slams in
  phoneBoard: 850, // phone: its leaderboard fades in, 350ms after its card
} as const;
