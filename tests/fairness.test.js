/**
 * Statistical tests for the raffle pick (lib/draw.js). They run the real pick
 * function hundreds of thousands of times and check the results look like a
 * fair, memoryless lottery.
 *
 * Each check uses a significance level of 1 in 10,000: a perfectly fair draw
 * would still fail a given check about once per 10,000 runs, so a failure is
 * worth re-running once before investigating.
 *
 * Run with `npm test`.
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { pickIndex, pickWinner, simulate } from "../lib/draw.js";
import {
  chanceNeverWon,
  chanceSomeoneRepeats,
  chiSquare,
  chiSquarePValue,
  drawsUntilRepeatLikely,
  expectedDistinctWinners,
} from "../lib/stats.js";

const ALPHA = 1e-4;

const assertLooksUniform = (counts, label) => {
  const stat = chiSquare(counts);
  const p = chiSquarePValue(stat, counts.length - 1);
  assert.ok(p > ALPHA, `${label}: counts too uneven to be chance (chi² = ${stat.toFixed(1)}, p = ${p.toExponential(2)})`);
  return p;
};

describe("statistics helpers (checked against textbook values)", () => {
  test("chi-square p-values", () => {
    assert.ok(Math.abs(chiSquarePValue(3.841, 1) - 0.05) < 1e-3);
    assert.ok(Math.abs(chiSquarePValue(18.307, 10) - 0.05) < 1e-3);
    assert.ok(Math.abs(chiSquarePValue(36.415, 24) - 0.05) < 1e-3);
    assert.ok(Math.abs(chiSquarePValue(0, 5) - 1) < 1e-12);
  });

  test("birthday problem", () => {
    assert.ok(Math.abs(chanceSomeoneRepeats(365, 23) - 0.5073) < 1e-3);
    assert.equal(drawsUntilRepeatLikely(365), 23);
    assert.equal(chanceSomeoneRepeats(25, 26), 1);
  });
});

describe("pickIndex", () => {
  test("rejects an empty pool", () => {
    for (const bad of [0, -1, 2.5, NaN]) assert.throws(() => pickIndex(bad), RangeError);
  });

  test("a pool of one always picks that person", () => {
    for (let i = 0; i < 1000; i++) assert.equal(pickIndex(1), 0);
  });

  test("stays in range and reaches every entry, including the first and last", () => {
    const counts = simulate(7, 70_000);
    assert.equal(counts.length, 7);
    assert.ok(counts.every((c) => c > 0));
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      70_000
    );
  });
});

describe("every entry has the same chance", () => {
  for (const n of [2, 3, 7, 25, 60, 150]) {
    test(`${n} people`, () => {
      assertLooksUniform(simulate(n, Math.max(200_000, n * 4_000)), `${n} people`);
    });
  }

  test("no bias for awkward pool sizes (where a naive `random % n` would favour low numbers)", () => {
    // With n = 3·2^29, reducing a 32-bit random number with `% n` would land
    // in the first third of the range ~50% more often than the last third.
    const n = 3 * 2 ** 29;
    const thirds = [0, 0, 0];
    for (let i = 0; i < 300_000; i++) thirds[Math.floor((pickIndex(n) * 3) / n)] += 1;
    assertLooksUniform(thirds, "thirds of a large range");
  });

  test("pickWinner draws people from the pool evenly", () => {
    const pool = Array.from({ length: 25 }, (_, i) => ({ _id: `id-${i}`, firstName: `Person ${i}` }));
    const counts = new Map(pool.map((p) => [p, 0]));
    for (let i = 0; i < 250_000; i++) {
      const w = pickWinner(pool);
      assert.ok(counts.has(w), "winner must come from the pool");
      counts.set(w, counts.get(w) + 1);
    }
    assertLooksUniform([...counts.values()], "25 people via pickWinner");
  });
});

describe("draws are independent (no memory, no streaks, no avoidance)", () => {
  const n = 25;
  const draws = 1_000_000;
  const seq = new Uint8Array(draws);
  for (let i = 0; i < draws; i++) seq[i] = pickIndex(n);

  test("every (last winner → next winner) pair is equally likely", () => {
    const pairs = new Array(n * n).fill(0);
    for (let i = 1; i < draws; i++) pairs[seq[i - 1] * n + seq[i]] += 1;
    assertLooksUniform(pairs, "consecutive pairs");
  });

  test("winning again right away happens 1 time in 25, as often as it should", () => {
    let repeats = 0;
    for (let i = 1; i < draws; i++) if (seq[i] === seq[i - 1]) repeats += 1;
    const rate = repeats / (draws - 1);
    const expected = 1 / n;
    const standardError = Math.sqrt((expected * (1 - expected)) / (draws - 1));
    assert.ok(
      Math.abs(rate - expected) < 4 * standardError,
      `back-to-back wins happened ${(rate * 100).toFixed(3)}% of the time, expected ${(expected * 100).toFixed(3)}%`
    );
  });

  test("gaps between a person's wins match a memoryless draw", () => {
    // For a fair draw, the wait between one person's wins is geometric:
    // P(gap = k) = (1 - 1/n)^(k-1) · (1/n). Bucket the gaps and compare.
    const last = new Array(n).fill(-1);
    const buckets = new Array(8).fill(0); // gaps 1-5, 6-10, ... 31-35, 36+
    let gaps = 0;
    for (let i = 0; i < draws; i++) {
      const w = seq[i];
      if (last[w] >= 0) {
        buckets[Math.min(7, Math.floor((i - last[w] - 1) / 5))] += 1;
        gaps += 1;
      }
      last[w] = i;
    }
    const q = 1 - 1 / n;
    const expected = buckets.map((_, b) => (b < 7 ? Math.pow(q, b * 5) - Math.pow(q, b * 5 + 5) : Math.pow(q, 35)) * gaps);
    const stat = buckets.reduce((s, o, b) => s + ((o - expected[b]) ** 2) / expected[b], 0);
    const p = chiSquarePValue(stat, buckets.length - 1);
    assert.ok(p > ALPHA, `gaps between wins don't look memoryless (chi² = ${stat.toFixed(1)}, p = ${p.toExponential(2)})`);
  });
});

describe("the numbers quoted on the fairness page match simulation", () => {
  const n = 25;
  const seasons = 40_000;

  test("chance someone has won twice within 10 draws", () => {
    let withRepeat = 0;
    for (let s = 0; s < seasons; s++) {
      const seen = new Set();
      for (let d = 0; d < 10; d++) {
        const w = pickIndex(n);
        if (seen.has(w)) {
          withRepeat += 1;
          break;
        }
        seen.add(w);
      }
    }
    const expected = chanceSomeoneRepeats(n, 10);
    assert.ok(Math.abs(withRepeat / seasons - expected) < 0.01, `${withRepeat / seasons} vs ${expected}`);
  });

  test("chance a particular person hasn't won in 26 draws, and how many different winners to expect", () => {
    let personZeroNeverWon = 0;
    let distinctTotal = 0;
    for (let s = 0; s < seasons; s++) {
      const seen = new Set();
      for (let d = 0; d < 26; d++) seen.add(pickIndex(n));
      if (!seen.has(0)) personZeroNeverWon += 1;
      distinctTotal += seen.size;
    }
    assert.ok(Math.abs(personZeroNeverWon / seasons - chanceNeverWon(n, 26)) < 0.01);
    assert.ok(Math.abs(distinctTotal / seasons - expectedDistinctWinners(n, 26)) < 0.1);
  });
});
