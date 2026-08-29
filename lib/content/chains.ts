// Chain Gang content: 10-word chains where every adjacent pair forms a common
// compound word or two-word phrase (FIRE→WORK = firework, WORK→SHOP = workshop).
// Word 1 is given; players solve words 2–10 in order. Keep every link genuinely
// common — a single obscure pair strands the whole chain. lib/chains.test.ts
// enforces the structural rules (10 words, A–Z only, no repeats inside a chain).
// Type-only import, erased at runtime: lib/chains.test.ts loads this file
// under plain node, where lib/supabase.ts (env vars, supabase-js) can't run.
import type { ChainRound } from "../supabase.ts";

export const CHAIN_BANK: ChainRound[] = [
  { words: ["FIRE", "WORK", "SHOP", "LIFT", "OFF", "SHORE", "LINE", "DANCE", "FLOOR", "PLAN"] },
  { words: ["BIRTHDAY", "CAKE", "WALK", "WAY", "SIDE", "SHOW", "TIME", "ZONE", "OUT", "LAW"] },
  { words: ["SNOW", "BALL", "PARK", "BENCH", "PRESS", "RELEASE", "DATE", "NIGHT", "CLUB", "HOUSE"] },
  { words: ["HIGH", "SCHOOL", "BUS", "STOP", "SIGN", "POST", "OFFICE", "PARTY", "ANIMAL", "FARM"] },
  { words: ["SUN", "FLOWER", "POWER", "PLANT", "FOOD", "CHAIN", "SAW", "DUST", "STORM", "CLOUD"] },
  { words: ["RAIN", "BOW", "TIE", "BREAK", "FAST", "FOOD", "TRUCK", "STOP", "WATCH", "DOG"] },
  { words: ["WATER", "PROOF", "READ", "OUT", "BREAK", "ROOM", "SERVICE", "DOG", "HOUSE", "PARTY"] },
  { words: ["MOON", "LIGHT", "SWITCH", "BLADE", "RUNNER", "UP", "GRADE", "SCHOOL", "YARD", "SALE"] },
  { words: ["HEAD", "PHONE", "BOOK", "CLUB", "SANDWICH", "BAG", "PIPE", "LINE", "UP", "TOWN"] },
  { words: ["COW", "BOY", "SCOUT", "MASTER", "MIND", "SET", "POINT", "GUARD", "DOG", "COLLAR"] },
  { words: ["GOLD", "FISH", "TANK", "TOP", "HAT", "TRICK", "SHOT", "GUN", "POWDER", "ROOM"] },
  { words: ["BLACK", "JACK", "RABBIT", "HOLE", "PUNCH", "BOWL", "GAME", "FACE", "PAINT", "BRUSH"] },
  { words: ["FRENCH", "TOAST", "MASTER", "KEY", "BOARD", "WALK", "OUT", "LOUD", "MOUTH", "WASH"] },
  { words: ["PEANUT", "BUTTER", "CUP", "CAKE", "POP", "CORN", "BREAD", "BASKET", "CASE", "STUDY"] },
  { words: ["STAR", "DUST", "PAN", "CAKE", "BATTER", "UP", "SET", "BACK", "YARD", "STICK"] },
  { words: ["EVER", "GREEN", "HOUSE", "HOLD", "UP", "RIGHT", "HAND", "SHAKE", "DOWN", "POUR"] },
  { words: ["SEA", "HORSE", "POWER", "NAP", "TIME", "TABLE", "SPOON", "FEED", "BACK", "PACK"] },
  { words: ["ICE", "CREAM", "CHEESE", "BURGER", "KING", "SIZE", "UP", "BEAT", "BOX", "SPRING"] },
  { words: ["THUNDER", "BIRD", "HOUSE", "FLY", "PAPER", "TRAIL", "MIX", "TAPE", "WORM", "HOLE"] },
  { words: ["ROCK", "CANDY", "CANE", "SUGAR", "RUSH", "HOUR", "GLASS", "HOUSE", "BOAT", "LOAD"] },
  { words: ["BED", "TIME", "OUT", "LET", "DOWN", "TOWN", "SQUARE", "DANCE", "PARTY", "BUS"] },
  { words: ["AIR", "LINE", "COOK", "BOOK", "STORE", "FRONT", "ROW", "BOAT", "RACE", "CAR"] },
  { words: ["LIGHT", "YEAR", "BOOK", "FAIR", "GROUND", "HOG", "WILD", "FIRE", "DRILL", "SERGEANT"] },
  { words: ["SMART", "PHONE", "CALL", "CENTER", "STAGE", "FRIGHT", "NIGHT", "SHIFT", "KEY", "NOTE"] },
  { words: ["BASE", "BALL", "CAP", "GUN", "FIGHT", "CLUB", "SODA", "POP", "QUIZ", "SHOW"] },
  { words: ["WIND", "MILL", "STONE", "COLD", "FRONT", "DOOR", "BELL", "PEPPER", "SPRAY", "PAINT"] },
  { words: ["DAY", "DREAM", "TEAM", "WORK", "HORSE", "SHOE", "BOX", "OFFICE", "CHAIR", "LIFT"] },
  { words: ["BODY", "GUARD", "RAIL", "ROAD", "TRIP", "WIRE", "TAP", "WATER", "SLIDE", "SHOW"] },
  { words: ["HONEY", "COMB", "OVER", "TIME", "MACHINE", "GUN", "SHOT", "PUT", "DOWN", "HILL"] },
  { words: ["STUNT", "DOUBLE", "CROSS", "WORD", "PLAY", "PEN", "NAME", "TAG", "TEAM", "SPIRIT"] },
];
