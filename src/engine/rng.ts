// Voorspelbare toevalsgenerator (mulberry32). De toestand zit in GameState,
// zodat een opgeslagen spel na het laden exact hetzelfde verder loopt.
// Handig voor tests: zelfde seed = zelfde resultaat.

export interface Rng {
  next(): number; // 0 <= x < 1
  int(min: number, max: number): number; // inclusief min en max
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  normal(mean: number, sd: number): number;
  poisson(lambda: number): number;
}

export function createRng(holder: { rngState: number }): Rng {
  const next = (): number => {
    holder.rngState = (holder.rngState + 0x6d2b79f5) | 0;
    let t = holder.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => items[Math.floor(next() * items.length)],
    normal: (mean, sd) => {
      const u = Math.max(next(), 1e-9);
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    poisson: (lambda) => {
      const limit = Math.exp(-lambda);
      let k = 0;
      let p = 1;
      do {
        k++;
        p *= next();
      } while (p > limit && k < 20);
      return k - 1;
    },
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, step = 1): number {
  return Math.round(value / step) * step;
}
