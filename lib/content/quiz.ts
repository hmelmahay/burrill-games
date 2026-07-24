import { QuizRound } from "../supabase";

import music from "./quiz-banks/music.json";
import movies from "./quiz-banks/movies.json";
import sports from "./quiz-banks/sports.json";
import food from "./quiz-banks/food.json";
import science from "./quiz-banks/science.json";
import history from "./quiz-banks/history.json";
import geography from "./quiz-banks/geography.json";
import weird from "./quiz-banks/weird.json";
import popculture from "./quiz-banks/popculture.json";
import general from "./quiz-banks/general.json";

// 500 questions, 50 per category. Each game shuffles the whole bank and
// draws up to 20, so repeats across games are rare.
export const QUIZ_BANK: QuizRound[] = [
  ...music,
  ...movies,
  ...sports,
  ...food,
  ...science,
  ...history,
  ...geography,
  ...weird,
  ...popculture,
  ...general,
] as QuizRound[];
