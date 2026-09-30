/**
 * Seasonal skins, shared by the live draw animation (components/DogFetch.js)
 * and the shareable winner card (lib/card.js), so a hat never differs between
 * the two. Everything here is plain data or SVG markup strings: safe on both
 * the server and the client.
 *
 * Swaying parts carry `data-sway="lean amplitude speed phase"` (radians,
 * radians, rad/s, radians). The animation rotates them by
 * `lean + amplitude · sin(t · speed + phase)`; the card shows them at `lean`.
 */

export const MINT = "#77ddaf";

// When each skin is on (month * 100 + day, inclusive). Outside these dates the
// brand look is used.
export const CALENDAR = [
  { theme: "newyear", from: 101, to: 107 },
  { theme: "valentines", from: 201, to: 214 },
  { theme: "stpatricks", from: 310, to: 317 },
  { theme: "spring", from: 401, to: 531 },
  { theme: "summer", from: 601, to: 831 },
  { theme: "halloween", from: 1001, to: 1031 },
  { theme: "autumn", from: 1101, to: 1130 },
  { theme: "holiday", from: 1201, to: 1231 },
];

/** The skin for a date (local time), or null for the brand look. */
export function themeForDate(date = new Date()) {
  const d = new Date(date);
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  return CALENDAR.find(({ from, to }) => md >= from && md <= to)?.theme ?? null;
}

// ---- shapes ------------------------------------------------------------------

export const HEART = "M 0 6 C -12 -3 -10 -14 0 -7 C 10 -14 12 -3 0 6 Z";
export const LEAF = "M 0 -10 C 7 -6 8 4 0 10 C -8 4 -7 -6 0 -10 Z";
const BAT_WING = "M -4 -2 C -14 -14 -30 -12 -40 -4 C -33 -2 -31 4 -27 7 C -23 1 -17 3 -13 7 C -10 1 -6 1 -3 3 Z";

const swayAttr = (lean, amp, speed, phase = 0) =>
  `data-sway="${lean} ${amp} ${speed} ${phase}" transform="rotate(${((lean * 180) / Math.PI).toFixed(2)})"`;

/** Three-leaf clover. */
export const cloverSvg = (fill = "#3fae61") =>
  [0, 120, 240].map((a) => `<path d="${HEART}" fill="${fill}" transform="rotate(${a}) translate(0 -9)"/>`).join("") +
  `<path d="M 0 2 Q 3 10 8 14" stroke="#2f8a4c" stroke-width="2" fill="none"/>`;

/** Jack-o'-lantern standing on the ground at x; its face is `data-part="face"`. */
export const pumpkinSvg = (x, scale) => `
  <g transform="translate(${x} 0) scale(${scale})">
    <ellipse cx="0" cy="3" rx="46" ry="8" fill="#000" opacity="0.35"/>
    <ellipse cx="0" cy="-30" rx="44" ry="31" fill="#d9701a"/>
    <ellipse cx="-17" cy="-30" rx="21" ry="30" fill="#ef8a2e"/>
    <ellipse cx="17" cy="-30" rx="21" ry="30" fill="#ef8a2e"/>
    <ellipse cx="0" cy="-30" rx="15" ry="31" fill="#f79a3e"/>
    <path d="M 0 -60 C 2 -70 8 -74 13 -72" fill="none" stroke="#3f7d5a" stroke-width="7" stroke-linecap="round"/>
    <g data-part="face" fill="#ffd45e">
      <path d="M -24 -36 L -13 -48 L -7 -34 Z"/>
      <path d="M 24 -36 L 13 -48 L 7 -34 Z"/>
      <path d="M -25 -22 Q 0 -4 25 -22 L 17 -19 L 12 -13 L 6 -19 L 0 -12 L -6 -19 L -12 -13 L -17 -19 Z"/>
    </g>
  </g>`;

/** A bat centred on its body; the wings group is `data-part="wings"`. */
export const batSvg = () => `
  <g data-part="wings">
    <path d="${BAT_WING}" fill="#0b0b0f"/>
    <path d="${BAT_WING}" fill="#0b0b0f" transform="scale(-1 1)"/>
  </g>
  <ellipse cx="0" cy="0" rx="6" ry="9" fill="#0b0b0f"/>
  <path d="M -4 -7 L -3 -14 L 0 -8 L 3 -14 L 4 -7 Z" fill="#0b0b0f"/>`;

/** Beach ball of radius 24 centred on the origin; the coloured panels are `data-part="spin"`. */
export const beachBallSvg = () => `
  <g data-part="spin">
    <circle cx="0" cy="0" r="24" fill="#fdfdfd"/>
    <path d="M 0 -24 A 24 24 0 0 1 20.8 12 L 0 0 Z" fill="#ff5d5d"/>
    <path d="M 20.8 12 A 24 24 0 0 1 -20.8 12 L 0 0 Z" fill="#4fb8ff"/>
    <path d="M -20.8 12 A 24 24 0 0 1 0 -24 L 0 0 Z" fill="#ffd35c"/>
    <circle cx="0" cy="0" r="5" fill="#fdfdfd"/>
  </g>
  <circle cx="0" cy="0" r="24" fill="none" stroke="#1d1914" stroke-width="1.5"/>
  <ellipse cx="-8" cy="-10" rx="6" ry="3.5" fill="#fff" opacity="0.7" transform="rotate(-35 -8 -10)"/>`;

// ---- themes --------------------------------------------------------------------

const moonTint = (ring, a, b, c, strength = 1) => ({
  ring,
  stops: [
    ["0", a, 0.3 * strength],
    ["0.72", b, 0.2 * strength],
    ["1", c, 0.12 * strength],
  ],
});

export const DEFAULT_MOON = {
  ring: MINT,
  stops: [
    ["0", "#d8f5e8", 0.26],
    ["0.72", "#bfeedb", 0.16],
    ["1", "#9fe9cb", 0.1],
  ],
};

const partyHatStripes = () =>
  [
    [-8, -16],
    [-24, -32],
    [-40, -48],
  ]
    .map(([y0, y1]) => {
      const w = (y) => (18 * (1 + y / 58)).toFixed(2);
      return `<path d="M ${-w(y0)} ${y0} L ${w(y0)} ${y0} L ${w(y1)} ${y1} L ${-w(y1)} ${y1} Z" fill="#f7c948"/>`;
    })
    .join("");

const heartBopper = (x, y, lean, phase) => `
  <g transform="translate(${x} ${y})">
    <g ${swayAttr(lean, 0.22, 5, phase)}>
      <path d="M 0 0 l -3 -6 l 6 -6 l -6 -6 l 6 -6 l -3 -6" fill="none" stroke="#2a2a31" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="${HEART}" fill="#ff5d8f" transform="translate(0 -38) scale(1.1)"/>
    </g>
  </g>`;

const bunnyEar = (x, lean, phase) => `
  <g transform="translate(${x} -4)">
    <g ${swayAttr(lean, 0.05, 2, phase)}>
      <ellipse cx="0" cy="-30" rx="9" ry="30" fill="#fafafa"/>
      <ellipse cx="0" cy="-30" rx="4.5" ry="21" fill="#ffb7cf"/>
    </g>
  </g>`;

/**
 * Per theme: `moon` (spotlight tint), `hat` (drawn in the dog's head frame,
 * origin at the centre of the head, facing +x) and `neck` (drawn over the
 * collar, in the neck frame; `clip-path="url(#dogCollarClip)"` wraps a band
 * round the neck the way the collar does).
 */
export const THEME_ART = {
  newyear: {
    moon: moonTint("#ffd76a", "#fff1c4", "#ffd96b", "#f7c948"),
    hat: `<g transform="translate(-2 -26) rotate(-18)">
      <path d="M -18 0 L 18 0 L 0 -58 Z" fill="${MINT}"/>${partyHatStripes()}
      <circle cx="0" cy="-60" r="6.5" fill="#fff3c4"/>
    </g>`,
  },
  valentines: {
    moon: moonTint("#ff9fc0", "#ffe0ec", "#ffb3cd", "#ff8fb3"),
    hat: `<g transform="translate(-4 -22)">
      <path d="M -26 6 C -22 -14 14 -16 22 2" fill="none" stroke="#e23e6f" stroke-width="4" stroke-linecap="round"/>
      ${heartBopper(-12, -8, -0.25, 0)}${heartBopper(8, -10, 0.2, 1.7)}
    </g>`,
  },
  stpatricks: {
    moon: moonTint("#9be07f", "#e3ffd9", "#b8f0a0", "#7fd66a"),
    hat: `<g transform="translate(-4 -26) rotate(-12)">
      <ellipse cx="0" cy="0" rx="32" ry="6.5" fill="#17613a"/>
      <path d="M -17 -1 L -21 -40 L 21 -40 L 17 -1 Z" fill="#1f7a45"/>
      <ellipse cx="0" cy="-40" rx="21" ry="5" fill="#248a4f"/>
      <rect x="-18.5" y="-12" width="37" height="8" fill="#111"/>
      <rect x="-6" y="-14" width="12" height="12" rx="1.5" fill="none" stroke="#f7c948" stroke-width="2.5"/>
    </g>`,
  },
  spring: {
    moon: moonTint("#e9c2ff", "#fbe8ff", "#f2d0ff", "#e2b4f5"),
    hat: `<g transform="translate(-6 -24)">
      <path d="M -24 8 C -20 -8 16 -10 22 6" fill="none" stroke="#f0b8d0" stroke-width="4" stroke-linecap="round"/>
      ${bunnyEar(-10, -0.28, 0)}${bunnyEar(8, 0.18, 1)}
    </g>`,
  },
  summer: {
    moon: moonTint("#ffd35c", "#fff6c8", "#ffe27a", "#ffc94a", 1.5), // it's a sun now
    // Sunglasses (the far lens is hidden in profile).
    hat: `<g>
      <line x1="4" y1="-15" x2="-20" y2="-18" stroke="${MINT}" stroke-width="3" stroke-linecap="round"/>
      <path d="M 2 -21 L 36 -21 L 34 -8 Q 30 1 19 1 Q 6 1 3 -8 Z" fill="#15151c" stroke="${MINT}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M 9 -15 L 20 -17" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.8"/>
      <path d="M 26 -16 L 29 -16.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
    </g>`,
  },
  halloween: {
    moon: moonTint("#ffb35c", "#ffe2b0", "#ffc274", "#f59e3b", 1.1),
    hat: `<g transform="translate(-4 -24) rotate(-14)">
      <ellipse cx="0" cy="0" rx="42" ry="8" fill="#1d1330"/>
      <path d="M -24 -2 L 20 -2 C 12 -30 6 -56 -2 -76 C -6 -86 -18 -92 -30 -84 C -20 -80 -14 -72 -12 -62 C -16 -40 -20 -20 -24 -2 Z" fill="#1d1330"/>
      <path d="M -22 -9 L 18 -9 L 15 -19 L -20 -19 Z" fill="${MINT}"/>
    </g>`,
  },
  autumn: {
    moon: moonTint("#f0a45c", "#ffe6c7", "#ffc58a", "#e8924a"),
    // Knit scarf over the collar (wrapped with the collar's clip), tail fluttering.
    neck: `<g>
      <g clip-path="url(#dogCollarClip)">
        <path d="M -20 -29 Q 14 -24 62 -28 L 62 -8 Q 14 -4 -20 -9 Z" fill="#c8492a"/>
        <path d="M -20 -22.5 Q 14 -17.5 62 -21.5" fill="none" stroke="#f2b544" stroke-width="3.5"/>
        <path d="M -20 -15.5 Q 14 -10.5 62 -14.5" fill="none" stroke="#f2b544" stroke-width="3.5"/>
      </g>
      <g transform="translate(8 -7)">
        <g ${swayAttr(0, 0.12, 3)}>
          <path d="M -6 0 L 6 0 L 9 34 L -3 34 Z" fill="#c8492a"/>
          <rect x="-4.5" y="12" width="12" height="3.5" fill="#f2b544" transform="rotate(5)"/>
          ${[0, 1, 2, 3].map((i) => `<line x1="${-2 + i * 3.2}" y1="34" x2="${-2.5 + i * 3.2}" y2="40" stroke="#c8492a" stroke-width="2"/>`).join("")}
        </g>
      </g>
    </g>`,
  },
  holiday: {
    moon: moonTint("#cfe3ff", "#f2f8ff", "#d9e9ff", "#bcd6ff"),
    // Santa hat flopping back, with a pom-pom.
    hat: `<g transform="translate(-2 -24) rotate(-8)">
      <path d="M 26 -4 C 22 -36 0 -60 -24 -62 C -40 -62 -50 -52 -56 -38 C -46 -44 -34 -44 -28 -38 C -24 -26 -26 -12 -28 -4 Z" fill="#d63a3a"/>
      <rect x="-32" y="-12" width="62" height="15" rx="7.5" fill="#f6f6f4"/>
      <circle cx="-57" cy="-37" r="10" fill="#f6f6f4"/>
    </g>`,
  },
};

export const THEME_NAMES = Object.keys(THEME_ART);

/** True only for a real theme name (not inherited keys like "constructor"). */
export const isTheme = (name) => typeof name === "string" && Object.hasOwn(THEME_ART, name);
