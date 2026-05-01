const ADJECTIVES = [
  "amber", "azure", "bold", "brave", "calm", "clever", "crisp", "dawn",
  "deep", "dusk", "ember", "fair", "fern", "frost", "gentle", "glow",
  "happy", "hazel", "ivory", "jade", "kind", "lake", "lush", "mint",
  "misty", "noble", "olive", "opal", "pale", "pine", "quiet", "ripe",
  "rose", "sage", "shy", "silk", "snow", "soft", "swift", "tide",
  "tiny", "twin", "vast", "vivid", "warm", "wild", "wise", "young",
];

const NOUNS = [
  "atlas", "beacon", "bloom", "brook", "canyon", "cedar", "cloud", "comet",
  "coral", "cove", "crane", "delta", "drift", "eagle", "echo", "ember",
  "fern", "field", "finch", "flare", "forge", "fox", "garden", "grove",
  "harbor", "haven", "hill", "isle", "lake", "lark", "leaf", "lily",
  "loom", "lyre", "marsh", "meadow", "moon", "node", "north", "oak",
  "orbit", "otter", "petal", "pine", "plum", "pond", "prism", "quill",
  "raven", "reef", "ridge", "river", "robin", "rune", "sage", "shore",
  "spark", "spire", "star", "stone", "stream", "swan", "thorn", "tide",
  "tower", "vale", "vine", "wave", "willow", "wing", "wood", "wren",
];

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomFrom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function randomToken(len: number): string {
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

export function generateId(): string {
  return `${randomFrom(ADJECTIVES)}-${randomFrom(NOUNS)}-${randomToken(3)}`;
}

export function isValidId(id: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && !id.startsWith(".");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
