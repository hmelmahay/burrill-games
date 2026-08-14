// Chameleon topic cards: a topic plus the 16 words on its card.
// Family-friendly, and every word is common enough that a one-word
// association clue is possible without being a giveaway.
export type ChamTopic = { topic: string; words: string[] };

export const CHAMELEON_TOPICS: ChamTopic[] = [
  {
    topic: "Animals",
    words: [
      "Elephant", "Penguin", "Kangaroo", "Shark",
      "Owl", "Snake", "Giraffe", "Dolphin",
      "Tiger", "Rabbit", "Spider", "Eagle",
      "Monkey", "Turtle", "Wolf", "Bee",
    ],
  },
  {
    topic: "Movies",
    words: [
      "Titanic", "Star Wars", "Jaws", "Frozen",
      "Shrek", "Rocky", "Jurassic Park", "Toy Story",
      "The Lion King", "Home Alone", "E.T.", "Ghostbusters",
      "Forrest Gump", "The Wizard of Oz", "Back to the Future", "Grease",
    ],
  },
  {
    topic: "Sports",
    words: [
      "Soccer", "Basketball", "Golf", "Tennis",
      "Boxing", "Swimming", "Baseball", "Hockey",
      "Skiing", "Volleyball", "Gymnastics", "Bowling",
      "Football", "Surfing", "Wrestling", "Darts",
    ],
  },
  {
    topic: "Food",
    words: [
      "Pizza", "Tacos", "Sushi", "Pancakes",
      "Spaghetti", "Ice Cream", "Hamburger", "Salad",
      "Popcorn", "Chocolate", "Soup", "Bacon",
      "Donuts", "Cheese", "Steak", "Waffles",
    ],
  },
  {
    topic: "Countries",
    words: [
      "France", "Japan", "Brazil", "Egypt",
      "Australia", "Canada", "Italy", "Mexico",
      "India", "Greece", "Ireland", "China",
      "Germany", "Spain", "Russia", "Kenya",
    ],
  },
  {
    topic: "At the Beach",
    words: [
      "Sandcastle", "Sunscreen", "Waves", "Seagull",
      "Lifeguard", "Towel", "Seashell", "Umbrella",
      "Flip-Flops", "Boogie Board", "Crab", "Cooler",
      "Snorkel", "Sunburn", "Volleyball Net", "Tide",
    ],
  },
  {
    topic: "School",
    words: [
      "Homework", "Recess", "Principal", "Locker",
      "Cafeteria", "Chalkboard", "Backpack", "Detention",
      "Gym Class", "Report Card", "Field Trip", "Pop Quiz",
      "School Bus", "Library", "Pencil", "Yearbook",
    ],
  },
  {
    topic: "Jobs",
    words: [
      "Firefighter", "Chef", "Astronaut", "Dentist",
      "Farmer", "Pilot", "Plumber", "Teacher",
      "Magician", "Lifeguard", "Mail Carrier", "Barber",
      "Judge", "Mechanic", "Nurse", "Clown",
    ],
  },
  {
    topic: "Musical Instruments",
    words: [
      "Guitar", "Drums", "Piano", "Violin",
      "Trumpet", "Flute", "Saxophone", "Banjo",
      "Harmonica", "Cello", "Bagpipes", "Tambourine",
      "Accordion", "Harp", "Tuba", "Triangle",
    ],
  },
  {
    topic: "Superheroes",
    words: [
      "Superman", "Batman", "Spider-Man", "Wonder Woman",
      "Hulk", "Iron Man", "Thor", "Flash",
      "Captain America", "Black Panther", "Aquaman", "Wolverine",
      "Green Lantern", "Ant-Man", "Supergirl", "Robin",
    ],
  },
  {
    topic: "Transportation",
    words: [
      "Airplane", "Submarine", "Skateboard", "Train",
      "Helicopter", "Canoe", "Motorcycle", "Hot Air Balloon",
      "Scooter", "Sailboat", "Fire Truck", "Bicycle",
      "Rocket", "Taxi", "Golf Cart", "Ferry",
    ],
  },
  {
    topic: "In the Kitchen",
    words: [
      "Microwave", "Blender", "Spatula", "Toaster",
      "Refrigerator", "Whisk", "Oven Mitt", "Cutting Board",
      "Dishwasher", "Frying Pan", "Rolling Pin", "Kettle",
      "Colander", "Apron", "Grater", "Timer",
    ],
  },
  {
    topic: "Holidays",
    words: [
      "Halloween", "Christmas", "Thanksgiving", "Easter",
      "New Year's Eve", "Valentine's Day", "Fourth of July", "St. Patrick's Day",
      "Mother's Day", "Father's Day", "Hanukkah", "April Fools' Day",
      "Labor Day", "Memorial Day", "Groundhog Day", "Mardi Gras",
    ],
  },
  {
    topic: "Fast Food",
    words: [
      "McDonald's", "Taco Bell", "Subway", "KFC",
      "Burger King", "Wendy's", "Chipotle", "Domino's",
      "Chick-fil-A", "Pizza Hut", "Dunkin'", "Five Guys",
      "Panda Express", "Arby's", "Sonic", "In-N-Out",
    ],
  },
  {
    topic: "Board Games",
    words: [
      "Monopoly", "Scrabble", "Chess", "Clue",
      "Risk", "Candy Land", "Battleship", "Checkers",
      "Sorry!", "Operation", "Jenga", "Uno",
      "Trivial Pursuit", "Connect Four", "Twister", "Yahtzee",
    ],
  },
  {
    topic: "Weather",
    words: [
      "Tornado", "Blizzard", "Rainbow", "Thunder",
      "Hail", "Fog", "Heat Wave", "Hurricane",
      "Drizzle", "Lightning", "Snowflake", "Wind",
      "Flood", "Frost", "Sunshine", "Cloud",
    ],
  },
  {
    topic: "Space",
    words: [
      "Mars", "Black Hole", "Astronaut", "Comet",
      "Saturn", "Moon", "Telescope", "Alien",
      "Rocket", "Meteor", "Galaxy", "Sun",
      "Satellite", "Gravity", "Space Station", "Pluto",
    ],
  },
  {
    topic: "Camping",
    words: [
      "Tent", "Campfire", "S'mores", "Sleeping Bag",
      "Flashlight", "Mosquito", "Hiking Boots", "Canteen",
      "Compass", "Marshmallow", "Lantern", "Trail Mix",
      "Bear", "Fishing Rod", "Bug Spray", "Ghost Stories",
    ],
  },
  {
    topic: "Fruits & Vegetables",
    words: [
      "Banana", "Broccoli", "Watermelon", "Carrot",
      "Pineapple", "Corn", "Strawberry", "Potato",
      "Grapes", "Onion", "Mango", "Cucumber",
      "Cherry", "Pumpkin", "Avocado", "Peas",
    ],
  },
  {
    topic: "Around the House",
    words: [
      "Couch", "Vacuum", "Doorbell", "Mirror",
      "Staircase", "Garage", "Bathtub", "Ceiling Fan",
      "Fireplace", "Mailbox", "Attic", "Curtains",
      "Lawn Mower", "Alarm Clock", "Remote Control", "Laundry",
    ],
  },
  {
    topic: "Halloween",
    words: [
      "Witch", "Pumpkin", "Ghost", "Vampire",
      "Candy Corn", "Skeleton", "Haunted House", "Zombie",
      "Spider Web", "Werewolf", "Trick-or-Treat", "Mummy",
      "Black Cat", "Costume", "Graveyard", "Broomstick",
    ],
  },
  {
    topic: "Christmas",
    words: [
      "Santa", "Reindeer", "Stocking", "Mistletoe",
      "Elf", "Snowman", "Sleigh", "Ornament",
      "Candy Cane", "Chimney", "Wreath", "Eggnog",
      "Present", "Carolers", "Fruitcake", "North Pole",
    ],
  },
];
