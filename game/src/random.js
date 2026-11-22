// random.js — a tiny seeded random number generator (mulberry32).
// The game is deterministic: same seed, same patrol wobble, same sparkle.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick a value in [min, max) from a seeded generator.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

// Pick one element of an array from a seeded generator.
export function pick(rng, list) {
  return list[Math.floor(rng() * list.length) % list.length];
}
