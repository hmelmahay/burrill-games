// Type-only, with extension: erased by node's type stripping so the test can
// load this bank without pulling in the supabase client.
import type { LetterRound } from "../supabase.ts";

// Letter Rip boards: a category and six answers, written easiest first —
// the board pays more toward the bottom (SLOT_POINTS in the game constants).
// `alts` are forgiveness for the SAME answer (spellings, short forms), never
// a different word — the mask already shows the real answer's first letter
// and length. Rules enforced by lib/letterrip.test.ts:
//   - exactly 6 answers per board
//   - no answer/alt duplicates another answer within its board (normalized)
export const LETTER_BANK: LetterRound[] = [
  {
    cat: "Tom Cruise movies",
    answers: [
      { a: "Top Gun" },
      { a: "Mission Impossible" },
      { a: "Jerry Maguire" },
      { a: "Rain Man" },
      { a: "A Few Good Men" },
      { a: "Risky Business" },
    ],
  },
  {
    cat: "Pizza toppings",
    answers: [
      { a: "Pepperoni" },
      { a: "Cheese", alts: ["extra cheese"] },
      { a: "Sausage" },
      { a: "Mushrooms", alts: ["mushroom"] },
      { a: "Onions", alts: ["onion"] },
      { a: "Pineapple" },
    ],
  },
  {
    cat: "Dog breeds",
    answers: [
      { a: "Labrador", alts: ["lab", "labrador retriever"] },
      { a: "Poodle" },
      { a: "German Shepherd", alts: ["german shepard"] },
      { a: "Golden Retriever", alts: ["golden"] },
      { a: "Bulldog", alts: ["bull dog"] },
      { a: "Chihuahua", alts: ["chiwawa", "chihuaha"] },
    ],
  },
  {
    cat: "Ice cream flavors",
    answers: [
      { a: "Vanilla" },
      { a: "Chocolate" },
      { a: "Strawberry" },
      { a: "Mint Chocolate Chip", alts: ["mint chip"] },
      { a: "Cookie Dough", alts: ["chocolate chip cookie dough"] },
      { a: "Rocky Road" },
    ],
  },
  {
    cat: "Things you bring to the beach",
    answers: [
      { a: "Towel", alts: ["towels", "beach towel"] },
      { a: "Sunscreen", alts: ["sun screen", "sunblock"] },
      { a: "Umbrella", alts: ["beach umbrella"] },
      { a: "Cooler" },
      { a: "Chairs", alts: ["chair", "beach chair", "beach chairs"] },
      { a: "Frisbee" },
    ],
  },
  {
    cat: "US presidents",
    answers: [
      { a: "Washington", alts: ["george washington"] },
      { a: "Lincoln", alts: ["abraham lincoln", "abe lincoln"] },
      { a: "Obama", alts: ["barack obama"] },
      { a: "Kennedy", alts: ["jfk", "john f kennedy", "john kennedy"] },
      { a: "Jefferson", alts: ["thomas jefferson"] },
      { a: "Roosevelt", alts: ["fdr", "franklin roosevelt", "teddy roosevelt"] },
    ],
  },
  {
    cat: "Breakfast foods",
    answers: [
      { a: "Eggs", alts: ["egg"] },
      { a: "Pancakes", alts: ["pancake"] },
      { a: "Bacon" },
      { a: "Cereal" },
      { a: "Waffles", alts: ["waffle"] },
      { a: "Oatmeal" },
    ],
  },
  {
    cat: "Superheroes",
    answers: [
      { a: "Superman" },
      { a: "Batman" },
      { a: "Spider-Man", alts: ["spiderman", "spider man"] },
      { a: "Wonder Woman" },
      { a: "Hulk", alts: ["incredible hulk"] },
      { a: "Captain America" },
    ],
  },
  {
    cat: "Disney animated movies",
    answers: [
      { a: "Frozen" },
      { a: "Lion King" },
      { a: "Aladdin", alts: ["alladin", "aladin"] },
      { a: "Moana" },
      { a: "Cinderella" },
      { a: "Beauty and the Beast", alts: ["beauty & the beast"] },
    ],
  },
  {
    cat: "Fast food chains",
    answers: [
      { a: "McDonald's", alts: ["mcdonalds", "mickey ds"] },
      { a: "Burger King" },
      { a: "Wendy's", alts: ["wendys"] },
      { a: "Taco Bell" },
      { a: "Subway" },
      { a: "Chick-fil-A", alts: ["chick fil a", "chickfila"] },
    ],
  },
  {
    cat: "Fruits",
    answers: [
      { a: "Apple", alts: ["apples"] },
      { a: "Banana", alts: ["bananas"] },
      { a: "Orange", alts: ["oranges"] },
      { a: "Grapes", alts: ["grape"] },
      { a: "Watermelon" },
      { a: "Strawberry", alts: ["strawberries"] },
    ],
  },
  {
    cat: "Vegetables",
    answers: [
      { a: "Carrots", alts: ["carrot"] },
      { a: "Corn" },
      { a: "Broccoli", alts: ["brocoli", "brocolli"] },
      { a: "Potatoes", alts: ["potato"] },
      { a: "Spinach" },
      { a: "Cucumber", alts: ["cucumbers"] },
    ],
  },
  {
    cat: "Sports",
    answers: [
      { a: "Football" },
      { a: "Basketball" },
      { a: "Baseball" },
      { a: "Soccer" },
      { a: "Tennis" },
      { a: "Hockey", alts: ["ice hockey"] },
    ],
  },
  {
    cat: "Board games",
    answers: [
      { a: "Monopoly" },
      { a: "Scrabble" },
      { a: "Clue" },
      { a: "Candy Land", alts: ["candyland"] },
      { a: "Risk" },
      { a: "Battleship", alts: ["battle ship"] },
    ],
  },
  {
    cat: "Animals at the zoo",
    answers: [
      { a: "Lion", alts: ["lions"] },
      { a: "Elephant", alts: ["elephants"] },
      { a: "Giraffe", alts: ["giraffes", "girafe"] },
      { a: "Monkey", alts: ["monkeys"] },
      { a: "Zebra", alts: ["zebras"] },
      { a: "Penguin", alts: ["penguins"] },
    ],
  },
  {
    cat: "Pixar movies",
    answers: [
      { a: "Toy Story" },
      { a: "Finding Nemo", alts: ["nemo"] },
      { a: "Up" },
      { a: "Cars" },
      { a: "Inside Out" },
      { a: "Ratatouille", alts: ["ratatouile", "ratatoulle"] },
    ],
  },
  {
    cat: "Tom Hanks movies",
    answers: [
      { a: "Forrest Gump", alts: ["forest gump"] },
      { a: "Big" },
      { a: "Cast Away", alts: ["castaway"] },
      { a: "Saving Private Ryan" },
      { a: "Apollo 13", alts: ["apollo thirteen"] },
      { a: "Toy Story" },
    ],
  },
  {
    cat: "Kitchen appliances",
    answers: [
      { a: "Microwave" },
      { a: "Toaster" },
      { a: "Oven" },
      { a: "Blender" },
      { a: "Refrigerator", alts: ["fridge"] },
      { a: "Dishwasher", alts: ["dish washer"] },
    ],
  },
  {
    cat: "Things you see at Christmas",
    answers: [
      { a: "Tree", alts: ["christmas tree", "trees"] },
      { a: "Santa", alts: ["santa claus"] },
      { a: "Presents", alts: ["present"] },
      { a: "Stockings", alts: ["stocking"] },
      { a: "Reindeer" },
      { a: "Eggnog", alts: ["egg nog"] },
    ],
  },
  {
    cat: "Popular pets",
    answers: [
      { a: "Dog", alts: ["dogs"] },
      { a: "Cat", alts: ["cats"] },
      { a: "Fish" },
      { a: "Hamster", alts: ["hamsters"] },
      { a: "Rabbit", alts: ["rabbits"] },
      { a: "Parrot", alts: ["parrots"] },
    ],
  },
  {
    cat: "Musical instruments",
    answers: [
      { a: "Guitar" },
      { a: "Piano" },
      { a: "Drums", alts: ["drum"] },
      { a: "Violin" },
      { a: "Trumpet" },
      { a: "Flute" },
    ],
  },
  {
    cat: "US states",
    answers: [
      { a: "California" },
      { a: "Texas" },
      { a: "Florida" },
      { a: "New York" },
      { a: "Hawaii" },
      { a: "Alaska" },
    ],
  },
  {
    cat: "Countries in Europe",
    answers: [
      { a: "France" },
      { a: "Italy" },
      { a: "Spain" },
      { a: "Germany" },
      { a: "England" },
      { a: "Greece" },
    ],
  },
  {
    cat: "Things in your wallet",
    answers: [
      { a: "Cash" },
      { a: "Credit Card", alts: ["credit cards"] },
      { a: "Driver's License", alts: ["drivers license", "license"] },
      { a: "Photos", alts: ["photo", "pictures"] },
      { a: "Coins", alts: ["coin", "change"] },
      { a: "Receipts", alts: ["receipt", "reciepts"] },
    ],
  },
  {
    cat: "Ways to cook an egg",
    answers: [
      { a: "Scrambled" },
      { a: "Fried" },
      { a: "Boiled", alts: ["hard boiled", "hardboiled", "soft boiled"] },
      { a: "Poached" },
      { a: "Omelet", alts: ["omelette", "omlet"] },
      { a: "Sunny Side Up", alts: ["sunnyside up"] },
    ],
  },
  {
    cat: "Halloween costumes",
    answers: [
      { a: "Witch" },
      { a: "Ghost" },
      { a: "Vampire" },
      { a: "Pirate" },
      { a: "Zombie" },
      { a: "Princess" },
    ],
  },
  {
    cat: "Things you take camping",
    answers: [
      { a: "Tent" },
      { a: "Sleeping Bag", alts: ["sleeping bags"] },
      { a: "Flashlight", alts: ["flash light"] },
      { a: "Marshmallows", alts: ["marshmallow", "marshmellows"] },
      { a: "Bug Spray", alts: ["bugspray"] },
      { a: "Lantern" },
    ],
  },
  {
    cat: "Summer Olympics sports",
    answers: [
      { a: "Swimming" },
      { a: "Gymnastics" },
      { a: "Track", alts: ["track and field"] },
      { a: "Volleyball", alts: ["volley ball"] },
      { a: "Diving" },
      { a: "Fencing" },
    ],
  },
  {
    cat: "Classic rock bands",
    answers: [
      { a: "Beatles" },
      { a: "Rolling Stones" },
      { a: "Queen" },
      { a: "Eagles" },
      { a: "Led Zeppelin", alts: ["led zepplin", "zeppelin"] },
      { a: "Fleetwood Mac", alts: ["fleetwood"] },
    ],
  },
  {
    cat: "Taylor Swift songs",
    answers: [
      { a: "Shake It Off" },
      { a: "Love Story" },
      { a: "Blank Space" },
      { a: "Bad Blood" },
      { a: "Anti-Hero", alts: ["anti hero", "antihero"] },
      { a: "Cruel Summer" },
    ],
  },
  {
    cat: "Things that are yellow",
    answers: [
      { a: "Sun", alts: ["the sun"] },
      { a: "Banana", alts: ["bananas"] },
      { a: "Lemon", alts: ["lemons"] },
      { a: "School Bus", alts: ["schoolbus"] },
      { a: "Corn" },
      { a: "Rubber Duck", alts: ["rubber ducky", "rubber duckie"] },
    ],
  },
  {
    cat: "Jobs kids say they want",
    answers: [
      { a: "Doctor" },
      { a: "Teacher" },
      { a: "Firefighter", alts: ["fireman", "fire fighter"] },
      { a: "Police Officer", alts: ["policeman", "police"] },
      { a: "Astronaut", alts: ["astronaught"] },
      { a: "Veterinarian", alts: ["vet", "vetrinarian"] },
    ],
  },
  {
    cat: "Classic sandwiches",
    answers: [
      { a: "Peanut Butter and Jelly", alts: ["pbj", "pb and j", "peanut butter jelly"] },
      { a: "Grilled Cheese" },
      { a: "BLT" },
      { a: "Turkey", alts: ["turkey sandwich"] },
      { a: "Ham and Cheese", alts: ["ham"] },
      { a: "Club", alts: ["club sandwich"] },
    ],
  },
  {
    cat: "Breakfast cereals",
    answers: [
      { a: "Cheerios" },
      { a: "Frosted Flakes" },
      { a: "Lucky Charms" },
      { a: "Froot Loops", alts: ["fruit loops"] },
      { a: "Cap'n Crunch", alts: ["capn crunch", "captain crunch"] },
      { a: "Cocoa Puffs", alts: ["coco puffs"] },
    ],
  },
  {
    cat: "Card games",
    answers: [
      { a: "Poker" },
      { a: "Uno" },
      { a: "Solitaire", alts: ["solitare"] },
      { a: "Go Fish", alts: ["gofish"] },
      { a: "Blackjack", alts: ["black jack"] },
      { a: "Hearts" },
    ],
  },
  {
    cat: "Things you see in the sky",
    answers: [
      { a: "Sun", alts: ["the sun"] },
      { a: "Moon", alts: ["the moon"] },
      { a: "Stars", alts: ["star"] },
      { a: "Clouds", alts: ["cloud"] },
      { a: "Birds", alts: ["bird"] },
      { a: "Airplane", alts: ["airplanes", "aeroplane"] },
    ],
  },
  {
    cat: "Harry Potter characters",
    answers: [
      { a: "Harry", alts: ["harry potter"] },
      { a: "Hermione", alts: ["hermione granger", "hermionie"] },
      { a: "Ron", alts: ["ron weasley"] },
      { a: "Dumbledore", alts: ["albus dumbledore", "dumbeldore"] },
      { a: "Snape", alts: ["severus snape"] },
      { a: "Hagrid" },
    ],
  },
  {
    cat: "Beloved TV sitcoms",
    answers: [
      { a: "Friends" },
      { a: "Seinfeld", alts: ["seinfield"] },
      { a: "The Office" },
      { a: "Cheers" },
      { a: "Frasier", alts: ["frazier"] },
      { a: "Full House" },
    ],
  },
  {
    cat: "Pie flavors",
    answers: [
      { a: "Apple" },
      { a: "Pumpkin" },
      { a: "Pecan" },
      { a: "Cherry" },
      { a: "Key Lime", alts: ["keylime"] },
      { a: "Blueberry", alts: ["blueberries"] },
    ],
  },
  {
    cat: "Things that happen at a wedding",
    answers: [
      { a: "Dance", alts: ["dancing"] },
      { a: "Cake", alts: ["cutting the cake", "cut the cake"] },
      { a: "Toast", alts: ["toasts", "the toast"] },
      { a: "Vows", alts: ["exchange vows", "saying vows"] },
      { a: "Bouquet Toss", alts: ["bouquet", "throwing the bouquet"] },
      { a: "Open Bar" },
    ],
  },
];
