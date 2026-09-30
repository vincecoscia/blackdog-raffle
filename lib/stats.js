/**
 * Small, dependency-free statistics for checking and explaining the draw.
 * Safe to import on both the server and the client.
 */

// ---- chi-square goodness of fit ----------------------------------------------

/** Pearson's chi-square statistic for observed counts against equal expected counts. */
export function chiSquare(counts) {
  const total = counts.reduce((a, b) => a + b, 0);
  const expected = total / counts.length;
  return counts.reduce((sum, c) => sum + ((c - expected) * (c - expected)) / expected, 0);
}

/**
 * Probability of a chi-square statistic at least this large if the draw were
 * perfectly fair (the p-value). Small values (e.g. < 0.001) would mean the
 * counts are too uneven to be chance.
 */
export function chiSquarePValue(stat, degreesOfFreedom) {
  return upperRegularizedGamma(degreesOfFreedom / 2, stat / 2);
}

function logGamma(x) {
  // Lanczos approximation (g = 7, n = 9).
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Q(s, x) = Γ(s, x) / Γ(s), via a series for small x and a continued fraction otherwise. */
function upperRegularizedGamma(s, x) {
  if (x <= 0) return 1;
  if (x < s + 1) {
    let sum = 1 / s;
    let term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (s + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + s * Math.log(x) - logGamma(s));
  }
  let b = x + 1 - s;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - s);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + s * Math.log(x) - logGamma(s)) * h;
}

// ---- plain-language probabilities for the fairness page ------------------------

/** Chance a particular person hasn't won yet after `draws` draws among `n` people. */
export const chanceNeverWon = (n, draws) => Math.pow((n - 1) / n, draws);

/** Chance that somebody has won at least twice after `draws` draws (the "birthday problem"). */
export function chanceSomeoneRepeats(n, draws) {
  if (draws > n) return 1;
  let allDifferent = 1;
  for (let i = 0; i < draws; i++) allDifferent *= (n - i) / n;
  return 1 - allDifferent;
}

/** First number of draws after which a repeat winner is more likely than not. */
export function drawsUntilRepeatLikely(n) {
  for (let d = 1; d <= n + 1; d++) if (chanceSomeoneRepeats(n, d) >= 0.5) return d;
  return n + 1;
}

/** Expected number of different people who've won after `draws` draws. */
export const expectedDistinctWinners = (n, draws) => n * (1 - Math.pow((n - 1) / n, draws));
