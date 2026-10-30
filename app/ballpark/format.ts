import type { BallparkRound } from "@/lib/supabase";

type Question = Pick<BallparkRound, "answer" | "unit">;

// A year question ("In what year did the Titanic sink?") has no unit and a
// whole-number answer from 1000 to 2100.  Every unitless question in
// lib/content/numbers.json is one, and the bank's only other answer in that
// range has a unit (the Grand Canyon's 1,857 m).
export function isYearQuestion(q: Question): boolean {
  return !q.unit && Number.isInteger(q.answer) && q.answer >= 1000 && q.answer <= 2100;
}

const grouped = (n: number) => n.toLocaleString();
const plain = (n: number) => n.toLocaleString(undefined, { useGrouping: false });

// How a round prints its answer and the guesses at it:  years without a
// thousands separator (1903, not 1,903), everything else as before.  How far
// off a guess was is an amount, so callers keep toLocaleString for that.
export function formatterFor(q: Question | undefined): (n: number) => string {
  return q && isYearQuestion(q) ? plain : grouped;
}
