import { MersenneTwister19937, shuffle, integer } from "random-js";

function toHex(int: number) {
  return int < 0
    ? "-0x" + (-int).toString(16).toUpperCase()
    : "0x" + int.toString(16).toUpperCase();
}

const MIN_INTEGER = -2147483648;
const MAX_INTEGER = 2147483647;

export function is32bitInteger(x: number) {
  return MIN_INTEGER <= x && x <= MAX_INTEGER;
}

const seedProducer = MersenneTwister19937.autoSeed();

function newSeed() {
  return integer(MIN_INTEGER, MAX_INTEGER)(seedProducer);
}

export type Randomizer = {
  readonly engine: MersenneTwister19937;
  readonly seed: number;
  readonly hex: string;
  readonly shuffle: <T>(array: readonly T[]) => T[];
};

export function randomizer(input: number | boolean): Randomizer | null {
  if (input === false) {
    return null;
  }

  const seed = input === true ? newSeed() : input;
  const engine = MersenneTwister19937.seed(seed);

  return {
    engine,
    seed,
    hex: toHex(seed),
    shuffle<T>(array: readonly T[]) {
      return shuffle(this.engine, [...array]);
    },
  };
}
