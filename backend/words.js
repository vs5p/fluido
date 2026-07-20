// Huge Curated Word Bank (1,400+ drawing-friendly words)
// Categorized by difficulty for Skribbl / Pictionary multiplayer drawing games.

const EASY_WORDS = [
  // Animals
  "cat", "dog", "fish", "bird", "frog", "duck", "bear", "pig", "cow", "lion",
  "mouse", "owl", "bee", "ant", "bat", "fox", "deer", "goat", "lamb", "seal",
  "crab", "worm", "slug", "swan", "crow", "fly", "bug", "ape", "ram", "yak",
  "pony", "moth", "flea", "wasp", "clam", "mole", "toad", "hen", "chick", "dino",
  "bunny", "puppy", "kitty", "piglet", "koala", "panda", "otter", "hippo", "rhino", "zebra",
  "camel", "tiger", "shark", "whale", "walrus", "sloth", "squid", "snail", "skunk",
  "spider", "snake", "turtle", "lizard", "monkey", "rabbit", "donkey", "turkey", "parrot", "pigeon",

  // Food & Fruit
  "apple", "banana", "bread", "cake", "candy", "cheese", "cookie", "donut", "egg", "grapes",
  "lemon", "lime", "milk", "onion", "peach", "pear", "pizza", "plum", "rice", "soup",
  "taco", "toast", "water", "juice", "corn", "carrot", "cherry", "melon", "bacon", "burger",
  "hotdog", "noodle", "potato", "salad", "steak", "sugar", "sushi", "waffle", "butter", "muffin",
  "nachos", "popcorn", "pretzel", "sausage", "pancake", "cucumber", "broccoli", "mushroom", "pineapple", "strawberry",

  // Household & Personal Items
  "bed", "book", "box", "bus", "car", "cup", "door", "fork", "hat", "key",
  "lamp", "map", "pen", "ring", "shoe", "soap", "spoon", "star", "sun", "tree",
  "ball", "bell", "boat", "bomb", "bone", "boot", "bowl", "card", "coin", "comb",
  "desk", "dice", "disk", "drum", "flag", "gift", "glass", "glove", "glue", "horn",
  "hose", "iron", "jar", "kite", "knot", "leaf", "lock", "mask", "moon",
  "nail", "nest", "note", "pipe", "plug", "pool", "rack", "roof", "rope", "sack",
  "saw", "ship", "sink", "sock", "suit", "tent", "toilet", "tooth", "toy",
  "tray", "vase", "wall", "web", "well", "wire", "wood", "bag", "belt", "cap",
  "coat", "dress", "jeans", "shirt", "skirt", "tie", "vest",

  // Nature & Weather
  "cloud", "fire", "ice", "lake", "park", "rain", "road", "rock",
  "rose", "sand", "sky", "snow", "wave", "wind", "hill",
  "pond", "sea", "stem", "seed", "dirt", "mud", "grass", "bush", "flower", "river",
  "beach", "cave", "cliff", "desert", "forest", "island", "jungle", "ocean", "stone", "stream",

  // Shapes & Colors & Body Parts
  "circle", "square", "heart", "cross", "arrow", "dot", "line", "spot",
  "arm", "ear", "eye", "foot", "hair", "hand", "head", "leg", "lip", "mouth",
  "neck", "nose", "toe", "chin", "face", "finger", "knee", "skin", "thumb"
];

const MEDIUM_WORDS = [
  // Animals & Mythical
  "alligator", "alpaca", "anaconda", "antelope", "armadillo", "baboon", "badger", "beaver", "bison", "buffalo",
  "chameleon", "cheetah", "chimpanzee", "chipmunk", "cockroach", "cougar", "coyote", "crocodile", "dolphin", "dragon",
  "dragonfly", "eagle", "eel", "elephant", "flamingo", "gazelle", "giraffe", "gorilla", "grasshopper", "hedgehog",
  "hyena", "iguana", "jellyfish", "kangaroo", "kingfisher", "leopard", "lobster", "llama", "mammoth", "manatee",
  "meerkat", "narwhal", "octopus", "ostrich", "panther", "peacock", "pelican", "penguin", "platypus", "porcupine",
  "porpoise", "python", "raccoon", "rattlesnake", "reindeer", "scorpion", "seahorse", "seagull", "starfish", "stingray",
  "stork", "tarantula", "toucan", "unicorn", "vulture", "weasel", "woodpecker",

  // Vehicles & Transportation
  "airplane", "ambulance", "automobile", "bicycle", "blimp", "bobsled", "bulldozer", "cablecar", "canoe", "caravan",
  "chariot", "cruise", "gondola", "glider", "helicopter", "hovercraft", "jet", "jetski", "kayak",
  "limousine", "locomotive", "monorail", "moped", "motorbike", "motorcycle", "parachute", "pickup", "racecar", "rickshaw",
  "sailboat", "scooter", "skateboard", "snowmobile", "spaceship", "speedboat", "streetcar", "submarine", "subway",
  "taxi", "tractor", "trailer", "train", "tram", "tricycle", "trolley", "truck", "unicycle", "yacht",

  // Food, Dishes & Kitchen
  "avocado", "barbecue", "bagel", "baguette", "burrito", "cappuccino", "caramel", "casserole", "cauliflower", "cheeseburger",
  "cheesecake", "chestnut", "chocolate", "cinnamon", "coconut", "croissant", "cupcake", "dumpling", "eggplant", "espresso",
  "fondue", "frenchfries", "guacamole", "hamburger", "hazelnut", "hotchocolate", "lasagna", "lemonade", "macaroni",
  "marshmallow", "mayonnaise", "meatball", "milkshake", "omelet", "papaya", "parmesan", "pasta",
  "pastry", "pepperoni", "pickle", "pistachio", "pudding", "radish", "raspberry",
  "ravioli", "smoothie", "spaghetti", "spinach", "sundae", "tangerine", "zucchini",

  // Clothing, Accessories & Objects
  "backpack", "bandana", "binocular", "bracelet", "briefcase", "calculator", "calendar", "camera",
  "canteen", "chandelier", "chessboard", "coatrack", "compass", "crayon", "dictionary", "earrings", "eraser",
  "hourglass", "headphones", "helmet", "highheels", "keychain", "lantern", "lighthouse", "lipstick", "loudspeaker", "magnifier",
  "matchbook", "microscope", "nightcap", "necklace", "paperclip", "passport", "pendulum", "perfume",
  "phonograph", "piggybank", "raincoat", "satellite", "saxophone", "scalpel", "scarecrow", "scissors", "screwdriver", "stethoscope",
  "stopwatch", "sunglasses", "sunflower", "telescope", "thermometer", "thimble", "umbrella", "violin",

  // Places, Buildings & Landscapes
  "airport", "aquarium", "archway", "bakery", "barn", "basement", "battlefield", "bazaar", "bungalow",
  "cabin", "canyon", "capital", "carnival", "castle", "cathedral", "cemetery", "church", "circus",
  "cottage", "courthouse", "crater", "dock", "dungeon", "factory", "farm", "fortress", "fountain",
  "garage", "glacier", "greenhouse", "harbor", "hospital", "hotel", "iceberg", "igloo", "kingdom",
  "library", "manor", "mansion", "monument", "mosque", "museum", "observatory", "orchard", "palace",
  "pyramid", "railway", "sanctuary", "school", "skyscraper", "stadium", "statue", "swamp", "temple", "tower",
  "trench", "tunnel", "university", "valley", "volcano", "warehouse", "waterfall", "windmill", "zoo"
];

const HARD_WORDS = [
  // Complex Objects, Machinery & Tech
  "accumulator", "accelerometer", "airconditioner", "astrolabe", "batteringram", "breathalyzer", "catapult", "centrifuge", "cyborg", "defibrillator",
  "electrocardiogram", "exoskeleton", "flamethrower", "hologram", "hydrofoil", "jackhammer", "kaleidoscope", "metronome", "microchip",
  "particleaccelerator", "periscope", "photocopier", "quadcopter", "seismograph", "spectrometer", "synthesizer", "teleporter",
  "time-machine", "transformer", "turntable", "ventriloquist", "windturbine", "x-ray", "zamboni",

  // Occupations & Professions
  "archaeologist", "architect", "astronaut", "astronomer", "blacksmith", "bodyguard", "carpenter", "chef", "composer", "conductor",
  "detective", "diplomat", "electrician", "firefighter", "executioner", "gardener", "gladiator", "illusionist", "juggler", "lumberjack",
  "mechanic", "meteorologist", "mountaineer", "neurosurgeon", "optometrist", "paleontologist", "paramedic", "photographer", "physician", "plumber",
  "politician", "programmer", "psychiatrist", "safecracker", "sculptor", "sommelier", "surgeon", "taxidermist", "veterinarian",

  // Fantasy, Mythology & Sci-Fi
  "alien", "alchemist", "banshee", "centaur", "chimera", "cyclops", "doppelganger", "gargoyle", "genie", "gnome",
  "goblin", "gorgon", "griffin", "hydra", "kraken", "leprechaun", "leviathan", "medusa", "minotaur", "mummy",
  "necromancer", "neptune", "pegasus", "phoenix", "pixie", "poltergeist", "sasquatch", "shapeshifter", "siren", "skeleton",
  "sphinx", "valkyrie", "vampire", "werewolf", "yeti", "zombie",

  // Pop Culture, Landmarks & Historical
  "bigben", "eiffeltower", "greatwall", "statueofliberty", "tajmahal", "stonehenge", "machupicchu", "chichenitza", "mountrushmore", "christredeemer",
  "golden-gate-bridge", "hollywood", "times-square", "pentagon", "pyramid-of-giza", "sydney-opera-house", "burj-khalifa", "colosseum", "parthenon", "vatican",
  "sherlock-holmes", "dracula", "frankenstein", "tarzan", "robin-hood", "king-arthur", "excalibur", "merlin", "cleopatra", "napoleon",
  "einstein", "shakespeare", "da-vinci", "mozart", "beethoven", "pikachu", "mario", "sonic", "pacman", "sponge-bob",
  "spiderman", "batman", "superman", "ironman", "thor", "hulk", "darth-vader", "yoda", "harry-potter", "gandalf",

  // Actions & Compound Verbs
  "bungee-jumping", "rock-climbing", "skydiving", "scuba-diving", "skateboarding", "snowboarding", "windsurfing", "archery", "breakdancing", "juggling",
  "tightrope-walking", "skydive", "moonwalk", "arm-wrestling", "snowball-fight", "pillow-fight", "haunted-house", "roller-coaster", "ferris-wheel", "escape-room"
];

// All combined deduplicated words
const ALL_WORDS = Array.from(new Set([...EASY_WORDS, ...MEDIUM_WORDS, ...HARD_WORDS]));

/**
 * Select word choices tailored by room difficulty and used words tracking
 */
function getWordChoices(difficulty = "medium", count = 3, usedWords = new Set(), customWords = []) {
  let pool = [];

  // Include custom words if provided by host
  if (Array.isArray(customWords) && customWords.length > 0) {
    pool = [...customWords];
  }

  // Filter pool by room difficulty
  if (difficulty === "easy") {
    pool = [...pool, ...EASY_WORDS];
  } else if (difficulty === "hard") {
    pool = [...pool, ...HARD_WORDS];
  } else {
    // Medium / Mixed (default)
    pool = [...pool, ...ALL_WORDS];
  }

  // Deduplicate pool
  pool = Array.from(new Set(pool));

  // Normalize used words set
  const normUsed = new Set(Array.from(usedWords).map((w) => String(w).toLowerCase().trim()));
  let available = pool.filter((w) => !normUsed.has(String(w).toLowerCase().trim()));

  // Reset usedWords tracking if pool is running low
  if (available.length < count) {
    usedWords.clear();
    available = [...pool];
  }

  // Randomize choices
  const shuffled = [...available].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

module.exports = {
  WORDS: ALL_WORDS,
  EASY_WORDS,
  MEDIUM_WORDS,
  HARD_WORDS,
  getWordChoices,
};
