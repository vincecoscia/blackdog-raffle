import { DOG_MOUTH, DOG_SITTING } from "@/lib/card-dog";
import {
  DEFAULT_MOON,
  HEART,
  LEAF,
  MINT,
  THEME_ART,
  batSvg,
  beachBallSvg,
  cloverSvg,
  pumpkinSvg,
} from "@/lib/themes";

/**
 * The winner card's artwork (everything except text, which the image renderer
 * lays out with real fonts on top). 1200×630, the standard share-image size.
 */
export const CARD = { width: 1200, height: 630 };

const FLOOR_Y = 548;
const DOG_X = 845;
const DOG_SCALE = 1.62;
const BONE_SCALE = 1.7; // a touch larger than life so the name reads
const MOON = { x: 905, y: 310, r: 250 };

const BONE_PATH =
  "M -33 -11 L 33 -11 A 15 15 0 1 1 58.2 0 A 15 15 0 1 1 33 11 L -33 11 A 15 15 0 1 1 -58.2 0 A 15 15 0 1 1 -33 -11 Z";

/** Where the bone sits and how much room its label has, for the text overlay. */
export const BONE = {
  x: DOG_X + DOG_MOUTH[0] * DOG_SCALE,
  y: FLOOR_Y + DOG_MOUTH[1] * DOG_SCALE + 8,
  labelWidth: 88 * BONE_SCALE,
  scale: BONE_SCALE,
};

// Small seeded PRNG so a given draw's card always looks the same.
function seeded(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scatter `count` items over the right-hand, picture side of the card. */
function scatter(rand, count, draw, { minX = 560, maxX = 1190, minY = 30, maxY = 520 } = {}) {
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = minX + rand() * (maxX - minX);
    const y = minY + rand() * (maxY - minY);
    const r = rand() * 360;
    const s = 0.7 + rand() * 0.8;
    out += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(0)}) scale(${s.toFixed(2)})">${draw(i, rand)}</g>`;
  }
  return out;
}

const confetti = (rand) =>
  scatter(
    rand,
    26,
    (i) => `<rect x="-5" y="-2.5" width="10" height="5" rx="1.5" fill="${[MINT, "#ffffff", "#ff8fb3", "#f7c948", "#a78bfa"][i % 5]}" opacity="0.85"/>`,
    { minX: 560, maxX: 1190, minY: 20, maxY: 300 }
  );

/** Static decorations for each theme (the card's take on the animated scene). */
const DECOR = {
  newyear: (rand) => {
    let bursts = "";
    for (const [cx, cy, color] of [
      [640, 110, "#f7c948"],
      [1110, 90, MINT],
      [1150, 250, "#ff8fb3"],
    ]) {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const r = 38 + rand() * 10;
        bursts += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="3" fill="${color}" opacity="0.9"/>`;
      }
    }
    return bursts;
  },
  valentines: (rand) =>
    scatter(rand, 14, (i) => `<path d="${HEART}" fill="${i % 2 ? "#ff5d8f" : "#ff9fc0"}" opacity="0.7" transform="scale(1.6)"/>`),
  stpatricks: (rand) => scatter(rand, 12, () => `<g opacity="0.85" transform="scale(1.4)">${cloverSvg()}</g>`),
  spring: (rand) =>
    scatter(rand, 22, (i) => `<ellipse rx="7" ry="4" fill="${i % 3 ? "#ffc4dc" : "#fff0f6"}" opacity="0.85"/>`),
  summer: () => {
    let rays = "";
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + 0.1;
      const pt = (r, da) => `${(MOON.x + Math.cos(a + da) * r).toFixed(1)} ${(MOON.y + Math.sin(a + da) * r).toFixed(1)}`;
      rays += `<path d="M ${pt(MOON.r + 6, -0.05)} L ${pt(MOON.r + 62, 0)} L ${pt(MOON.r + 6, 0.05)} Z" fill="#ffd35c"/>`;
    }
    return `<g opacity="0.35" clip-path="url(#sky)">${rays}</g>
      <ellipse cx="1110" cy="${FLOOR_Y + 3}" rx="34" ry="7" fill="#000" opacity="0.35"/>
      <g transform="translate(1110 ${FLOOR_Y - 32}) scale(1.35) rotate(25)">${beachBallSvg()}</g>`;
  },
  halloween: () =>
    `<g transform="translate(0 ${FLOOR_Y})">${pumpkinSvg(1120, 1.15)}${pumpkinSvg(600, 0.8)}</g>` +
    [
      [700, 120, 0.9],
      [1060, 70, 0.7],
      [1140, 190, 0.55],
    ]
      .map(([x, y, s]) => `<g transform="translate(${x} ${y}) scale(${s * 1.4})">${batSvg()}</g>`)
      .join(""),
  autumn: (rand) =>
    scatter(
      rand,
      16,
      (i) =>
        `<g transform="scale(1.5)"><path d="${LEAF}" fill="${["#d9531e", "#e8a33d", "#b8421d", "#f0c05a"][i % 4]}" opacity="0.9"/><line x1="0" y1="-8" x2="0" y2="12" stroke="#7a3413" stroke-width="1.2" opacity="0.8"/></g>`
    ),
  holiday: (rand) =>
    scatter(rand, 60, () => `<circle r="${(2 + rand() * 2.5).toFixed(1)}" fill="#fff" opacity="${(0.4 + rand() * 0.5).toFixed(2)}"/>`, {
      minX: 600,
      maxX: 1200,
      minY: 0,
      maxY: 600,
    }),
};

/** The card's picture as an SVG document (no text). */
export function cardScene({ theme, seed }) {
  const rand = seeded(seed);
  const art = THEME_ART[theme];
  const moon = art?.moon ?? DEFAULT_MOON;
  const dog = DOG_SITTING.replace("{{HAT}}", art?.hat ?? "").replace("{{NECK}}", art?.neck ?? "");
  // Brighter than the live scene: the card is small in a chat thread and the
  // dog's silhouette needs to pop.
  const stops = moon.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${Math.min(1, a * 1.9)}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD.width}" height="${CARD.height}" viewBox="0 0 ${CARD.width} ${CARD.height}">
  <defs>
    <radialGradient id="bg" cx="70%" cy="40%" r="80%"><stop offset="0" stop-color="#12261f"/><stop offset="1" stop-color="#070709"/></radialGradient>
    <radialGradient id="moon">${stops}</radialGradient>
    <radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity="0.6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${MINT}" stop-opacity="0.22"/><stop offset="1" stop-color="${MINT}" stop-opacity="0"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${MINT}" stop-opacity="0.1"/><stop offset="1" stop-color="${MINT}" stop-opacity="0"/></linearGradient>
    <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1.1" fill="#fff" fill-opacity="0.06"/></pattern>
    <clipPath id="sky"><rect x="0" y="0" width="${CARD.width}" height="${FLOOR_Y}"/></clipPath>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect width="100%" height="${FLOOR_Y}" fill="url(#dots)"/>
  <circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}" fill="url(#moon)"/>
  <circle cx="${MOON.x}" cy="${MOON.y}" r="${MOON.r}" fill="none" stroke="${moon.ring}" stroke-opacity="0.3" stroke-width="2"/>
  <rect x="0" y="${FLOOR_Y}" width="${CARD.width}" height="${CARD.height - FLOOR_Y}" fill="url(#floor)"/>
  <line x1="0" y1="${FLOOR_Y}" x2="${CARD.width}" y2="${FLOOR_Y}" stroke="${MINT}" stroke-opacity="0.45" stroke-width="2"/>
  ${(DECOR[theme] ?? (() => ""))(rand)}
  <ellipse cx="${DOG_X - 10}" cy="${FLOOR_Y + 4}" rx="${70 * DOG_SCALE}" ry="${9 * DOG_SCALE}" fill="url(#shadow)"/>
  <g transform="translate(${DOG_X} ${FLOOR_Y}) scale(${DOG_SCALE})">${dog}</g>
  <circle cx="${BONE.x}" cy="${BONE.y}" r="${95 * BONE_SCALE}" fill="url(#glow)"/>
  <g transform="translate(${BONE.x.toFixed(1)} ${BONE.y.toFixed(1)}) scale(${BONE_SCALE})">
    <path d="${BONE_PATH}" fill="none" stroke="${MINT}" stroke-width="10" stroke-linejoin="round" opacity="0.55"/>
    <path d="${BONE_PATH}" fill="#d6c5a4" transform="translate(0 4)"/>
    <path d="${BONE_PATH}" fill="#f2e8d5" stroke="#1d1914" stroke-width="2" stroke-linejoin="round"/>
    <path d="M -30 -5.5 L 18 -5.5" stroke="#fffaf0" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
  </g>
  ${theme ? "" : confetti(rand)}
</svg>`;
}
