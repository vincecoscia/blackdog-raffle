/**
 * Builds the strip of names the slot reel scrolls through.
 *
 * The strip is *theatre*: the actual winner is chosen server-side. But it is
 * honest theatre — teammates with more tickets appear more often (capped so one
 * person can't flood the reel), and the order is a seeded shuffle so the server
 * and client render the same strip (no hydration mismatch) and the reel doesn't
 * reshuffle on every render.
 */

const MAX_APPEARANCES = 4;

// mulberry32: tiny seeded PRNG, plenty good for shuffling a list of names.
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildStrip(employees) {
  const pool = employees.filter((e) => e.entries > 0);
  if (pool.length === 0) return [];

  const rand = prng(hash(pool.map((e) => `${e._id}:${e.entries}`).join("|")));

  const strip = [];
  for (const e of pool) {
    const copies = Math.min(e.entries, MAX_APPEARANCES);
    for (let i = 0; i < copies; i++) strip.push(e);
  }

  // Fisher–Yates with the seeded generator.
  for (let i = strip.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [strip[i], strip[j]] = [strip[j], strip[i]];
  }

  // Best-effort pass to keep the same face from appearing twice in a row
  // (also checks the wrap-around, since the reel loops).
  if (pool.length > 1) {
    for (let i = 0; i < strip.length; i++) {
      const next = (i + 1) % strip.length;
      if (strip[i]._id !== strip[next]._id) continue;
      for (let k = 1; k < strip.length; k++) {
        const cand = (next + k) % strip.length;
        const before = (cand - 1 + strip.length) % strip.length;
        const after = (cand + 1) % strip.length;
        if (
          strip[cand]._id !== strip[i]._id &&
          strip[before]._id !== strip[next]._id &&
          strip[after]._id !== strip[next]._id
        ) {
          [strip[next], strip[cand]] = [strip[cand], strip[next]];
          break;
        }
      }
    }
  }

  return strip;
}

/** Item at any position in the conceptually infinite reel. */
export const at = (strip, index) => strip[((index % strip.length) + strip.length) % strip.length];

/**
 * Motion profile for one draw, in px along the strip. Three phases with a
 * continuous velocity curve — a slot reel, not a CSS ease:
 *
 *   accelerate (t1)  →  cruise at vmax (t2)  →  constant-friction decel (t3)
 *
 * Deceleration ends at `vend`, *not* zero: the reel is still moving when it
 * hits the winner, and a spring "detent" (see `detent`) absorbs the rest. That
 * gives the satisfying mechanical clunk instead of an asymptotic crawl.
 */
export function planMotion({ distance, v0 = 0, reduced = false }) {
  const t1 = reduced ? 0.2 : 0.7;
  const t3 = reduced ? 1.0 : 4.2;
  const vend = reduced ? 120 : 240;
  const cap = reduced ? 3000 : 2400; // px/s — beyond this the blur is just noise

  let t2 = reduced ? 0.15 : 1.1;
  const fixed = t1 * v0 * 0.5 + t3 * vend * 0.5;
  let vmax = (distance - fixed) / (t1 / 2 + t2 + t3 / 2);
  if (vmax > cap) {
    // Long strip: stretch the cruise instead of going faster.
    vmax = cap;
    t2 = (distance - fixed) / vmax - t1 / 2 - t3 / 2;
  }

  const d1 = (t1 * (v0 + vmax)) / 2;
  const d2 = vmax * t2;
  const duration = t1 + t2 + t3;

  const positionAt = (t) => {
    if (t <= 0) return 0;
    if (t < t1) return v0 * t + ((vmax - v0) * t * t) / (2 * t1);
    if (t < t1 + t2) return d1 + vmax * (t - t1);
    if (t < duration) {
      const tau = t - t1 - t2;
      return d1 + d2 + vmax * tau - ((vmax - vend) * tau * tau) / (2 * t3);
    }
    return distance;
  };

  const velocityAt = (t) => {
    if (t <= 0) return v0;
    if (t < t1) return v0 + ((vmax - v0) * t) / t1;
    if (t < t1 + t2) return vmax;
    if (t < duration) return vmax - ((vmax - vend) * (t - t1 - t2)) / t3;
    return 0;
  };

  return { duration, vmax, vend, positionAt, velocityAt };
}

/**
 * Under-damped spring displacement after the reel hits its stop with velocity
 * `vend`: overshoots a few pixels, springs back, dies out in under a second.
 */
export const DETENT_DURATION = 0.9;
export function detent(t, vend) {
  if (t <= 0 || t >= DETENT_DURATION) return 0;
  const omega = 2 * Math.PI * 2.6;
  const zeta = 0.32;
  const omegaD = omega * Math.sqrt(1 - zeta * zeta);
  return (vend / omegaD) * Math.exp(-zeta * omega * t) * Math.sin(omegaD * t);
}

/** First index >= from + minAhead whose item is the winner, or -1. */
export function findLanding(strip, winnerId, from, minAhead) {
  if (strip.length === 0) return -1;
  const start = from + minAhead;
  for (let i = start; i < start + strip.length; i++) {
    if (at(strip, i)._id === winnerId) return i;
  }
  return -1;
}
