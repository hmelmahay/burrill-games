// Hand-written clues so a bot can take the psychic seat and the humans get to
// guess. Clues are bucketed into five zones across the 0-100 dial:
//   zone 0 = 0-20 (hard left) … zone 4 = 80-100 (hard right)
// A bot psychic picks a scale from this bank, picks a zone, then the secret
// spot is placed inside that zone — so the clue always honestly points at it.
//
// Only scales listed here are ever handed to a bot psychic; humans still get
// the full VIBE_SCALES list.

export type ClueScale = {
  left: string;
  right: string;
  zones: [string[], string[], string[], string[], string[]];
};

export const VIBE_CLUE_BANK: ClueScale[] = [
  {
    left: "Hot",
    right: "Cold",
    zones: [
      ["lava", "the surface of the sun", "a fresh jalapeño"],
      ["coffee straight from the pot", "asphalt in August"],
      ["bathwater", "soda left on the counter"],
      ["a basement in spring", "iced tea"],
      ["an ice rink", "the back of the freezer"],
    ],
  },
  {
    left: "Overrated",
    right: "Underrated",
    zones: [
      ["New Year's Eve", "celebrity fragrance"],
      ["brunch", "Black Friday"],
      ["pizza", "the weather forecast"],
      ["public libraries", "an afternoon nap"],
      ["dental floss", "a sandwich you made yourself"],
    ],
  },
  {
    left: "Cheap",
    right: "Expensive",
    zones: [
      ["instant noodles", "tap water"],
      ["a bus ticket", "a used paperback"],
      ["a decent pair of jeans", "dinner for two"],
      ["a laptop", "a very good mattress"],
      ["a house", "a private jet"],
    ],
  },
  {
    left: "Healthy",
    right: "Junk food",
    zones: [
      ["steamed broccoli", "a plain green salad"],
      ["an apple with peanut butter", "brown rice"],
      ["a turkey sandwich", "granola"],
      ["pepperoni pizza", "a basket of fries"],
      ["a deep-fried candy bar", "a gas station corn dog"],
    ],
  },
  {
    left: "Loud",
    right: "Quiet",
    zones: [
      ["a jet engine", "the front row of a rock concert"],
      ["a packed restaurant", "a lawnmower"],
      ["ordinary conversation", "a dishwasher running"],
      ["a library", "someone turning a page"],
      ["falling snow", "holding your breath"],
    ],
  },
  {
    left: "Scary",
    right: "Cozy",
    zones: [
      ["a dark basement at 3am", "a jump scare"],
      ["a thunderstorm outside", "an old house creaking"],
      ["a campfire ghost story", "a grey rainy afternoon"],
      ["a wool blanket", "a cat asleep on your lap"],
      ["a fireplace and hot cocoa", "fresh sheets on the bed"],
    ],
  },
  {
    left: "Summer",
    right: "Winter",
    zones: [
      ["a beach towel", "a melting popsicle"],
      ["running through a sprinkler", "shorts weather"],
      ["a light jacket", "leaves changing colour"],
      ["a wool hat", "soup for dinner"],
      ["a blizzard", "scraping ice off the windshield"],
    ],
  },
  {
    left: "Sweet",
    right: "Savoury",
    zones: [
      ["cotton candy", "a bowl of frosting"],
      ["a glazed doughnut", "maple syrup on pancakes"],
      ["teriyaki", "honey-glazed ham"],
      ["a soft pretzel", "roast chicken"],
      ["anchovies", "a jug of gravy"],
    ],
  },
  {
    left: "Dog energy",
    right: "Cat energy",
    zones: [
      ["a golden retriever meeting literally anyone", "a wagging tail"],
      ["an enthusiastic hello at the door", "playing fetch"],
      ["a nap together on the couch", "a polite greeting"],
      ["ignoring you until dinnertime", "claiming the one sunbeam"],
      ["knocking a glass off the table while holding eye contact", "silent judgement"],
    ],
  },
  {
    left: "Beach vacation",
    right: "Mountain vacation",
    zones: [
      ["sunscreen", "a boogie board"],
      ["sand in absolutely everything", "a boardwalk arcade"],
      ["a lake house", "a frisbee"],
      ["a hiking trail", "a flannel shirt"],
      ["a ski lift", "a cabin in the pines"],
    ],
  },
  {
    left: "Snack",
    right: "Meal",
    zones: [
      ["a single pretzel", "three almonds"],
      ["a granola bar", "a handful of chips"],
      ["a big bowl of popcorn", "cheese and crackers"],
      ["a burrito", "soup and a sandwich"],
      ["Thanksgiving dinner", "a three-course tasting menu"],
    ],
  },
  {
    left: "Easy to learn",
    right: "Hard to master",
    zones: [
      ["tic tac toe", "rock paper scissors"],
      ["checkers", "riding a bike"],
      ["home cooking", "guitar"],
      ["chess", "golf"],
      ["the violin", "brain surgery"],
    ],
  },
];
