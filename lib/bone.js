/**
 * The name bone's look, shared by the live draw (components/DogFetch.js) and
 * the winner card (lib/card.js) so the two never drift apart. Bone-local
 * units: centred on the origin, about 123 × 53, the label on the shaft.
 */

// A waisted shaft that flares into four round knobs (centres ±47, ±12).
export const BONE_PATH =
  "M -24 -11 C -8 -10 8 -10 24 -11 C 29 -11 32 -13.2 33.4 -17 A 14.5 14.5 0 1 1 55.14 0 " +
  "A 14.5 14.5 0 1 1 33.4 17 C 32 13.2 29 11 24 11 C 8 10 -8 10 -24 11 C -29 11 -32 13.2 -33.4 17 " +
  "A 14.5 14.5 0 1 1 -55.14 0 A 14.5 14.5 0 1 1 -33.4 -17 C -32 -13.2 -29 -11 -24 -11 Z";

export const BONE_INK = "#2e2119"; // lettering
export const BONE_EMBOSS = "#fffaf0"; // light edge under stamped lettering

/** The face gradient BONE_ART fills with; goes in the page's <defs>. */
export const boneDefs = () => `
  <linearGradient id="boneFace" gradientUnits="userSpaceOnUse" x1="0" y1="-17" x2="0" y2="19">
    <stop offset="0" stop-color="#fffaf0"/>
    <stop offset="0.5" stop-color="#f4e8d0"/>
    <stop offset="1" stop-color="#e2cda3"/>
  </linearGradient>`;

// Gloss along the top of the shaft and on the two upper knobs.
const GLOSS = "M -19 -7.6 C -7 -8.2 7 -8.2 17 -7.6 M -56.4 -15.4 A 10 10 0 0 1 -51.2 -21.1 M 40.6 -19.7 A 10 10 0 0 1 45.6 -21.9";

/**
 * Drop shadow, shaded face and gloss (no label). Three paths, like the old
 * flat bone: the pile has 20–40 of these redrawn every frame.
 */
export const BONE_ART =
  `<path d="${BONE_PATH}" fill="#000" fill-opacity="0.3" transform="translate(1.5 4.5)"/>` +
  `<path d="${BONE_PATH}" fill="url(#boneFace)" stroke="#3a2a1d" stroke-width="2.2" stroke-linejoin="round"/>` +
  `<path d="${GLOSS}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-opacity="0.85"/>`;
