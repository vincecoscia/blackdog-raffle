import { randomInt } from "node:crypto";
import { chiSquare, chiSquarePValue } from "./stats.js";

/**
 * The raffle pick, kept free of database code so the real draw, the fairness
 * page's live demo and the statistical tests all run the exact same function.
 *
 * `crypto.randomInt(n)` returns a uniformly distributed integer in [0, n)
 * from the operating system's cryptographically secure random source, and
 * uses rejection sampling so there is no modulo bias for any `n`.
 */
export function pickIndex(n) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError("Need at least one entry to draw from.");
  return randomInt(n);
}

/** One entry per person: pick one person from the pool, each equally likely. */
export function pickWinner(pool) {
  return pool[pickIndex(pool.length)];
}

/**
 * Monthly draw: every entry is a ticket. Number all the tickets, pick one
 * with the same uniform pick as above, and the winner is whoever holds it —
 * so 3 entries are exactly three times as likely to win as 1.
 */
export function pickWeighted(pool, ticketsOf) {
  const tickets = pool.map(ticketsOf);
  if (!tickets.every((t) => Number.isInteger(t) && t > 0)) {
    throw new RangeError("Everyone in the draw needs at least one whole entry.");
  }
  let ticket = pickIndex(tickets.reduce((a, b) => a + b, 0));
  for (let i = 0; i < pool.length; i++) {
    ticket -= tickets[i];
    if (ticket < 0) return pool[i];
  }
}

/** Run `draws` weighted picks and count how often each entrant won. */
export function simulateWeighted(tickets, draws) {
  const pool = tickets.map((t, i) => ({ i, t }));
  const counts = new Array(tickets.length).fill(0);
  for (let d = 0; d < draws; d++) counts[pickWeighted(pool, (p) => p.t).i] += 1;
  return counts;
}

/** Run `draws` picks over `n` entries and count how often each entry won. */
export function simulate(n, draws) {
  const counts = new Array(n).fill(0);
  for (let i = 0; i < draws; i++) counts[pickIndex(n)] += 1;
  return counts;
}

/** A simulation plus its summary, for the fairness page's live demo. */
export function fairnessDemo(n, draws) {
  const started = performance.now();
  const counts = simulate(n, draws);
  const ms = Math.round(performance.now() - started);
  const stat = chiSquare(counts);
  return {
    n,
    draws,
    counts,
    min: Math.min(...counts),
    max: Math.max(...counts),
    chiSquare: stat,
    pValue: chiSquarePValue(stat, n - 1),
    ms,
  };
}
