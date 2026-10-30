// Reveal timing for Emoji Cinema, in ms after the reveal phase starts. The host
// screen and the phones both read these, so a phone's result never lands before
// the title lights up on the big screen.
export const REVEAL = {
  title: 250, // the answer lights up; the phone's result card slams in
  list: 400, // everyone's guesses rise in, 60ms apart
  board: 600, // the leaderboard fades in and counts up
} as const;
