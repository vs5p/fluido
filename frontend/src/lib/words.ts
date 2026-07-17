export const WORDS = {
  easy: ["apple", "house", "tree", "car", "fish", "sun", "star", "cat", "boat", "hat"],
  medium: ["guitar", "rocket", "castle", "penguin", "octopus", "volcano", "lighthouse", "robot"],
  hard: ["chandelier", "stethoscope", "kaleidoscope", "metronome", "platypus", "wheelbarrow"],
};

export function pickWord(): string {
  const tier = Math.random() < 0.5 ? "easy" : Math.random() < 0.75 ? "medium" : "hard";
  const pool = WORDS[tier as keyof typeof WORDS];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function maskWord(word: string, revealed: Set<number> = new Set()) {
  return word
    .split("")
    .map((c, i) => (c === " " ? "  " : revealed.has(i) ? c : "_"))
    .join(" ");
}
