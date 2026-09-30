/**
 * The dog in its sitting, bone-presenting pose, for the winner card.
 *
 * Captured from the live rig in components/DogFetch.js (same shapes and
 * colours, joints solved for the pose the dog holds while showing off the
 * winning bone), so the card dog matches the animation. If the dog's design
 * changes there, recapture this. Coordinates are dog-local: origin on the
 * ground under the hips, facing +x, up is -y.
 *
 * {{HAT}} and {{NECK}} are replaced with the theme's markup (lib/themes.js),
 * and {{COLLAR}} with DOG_COLLAR unless the theme brings its own neckwear.
 */
export const DOG_SITTING = `<g transform="translate(-50 -45) rotate(-35.52)"><g transform="translate(100 18) rotate(48.05)"><g transform="translate(0 48) rotate(-52.74)"><line x1="0" y1="0" x2="0" y2="44" stroke="#202027" stroke-width="15" stroke-linecap="round"></line><g transform="translate(0 44) rotate(40.22)"><ellipse cx="5" cy="0" rx="13" ry="8" fill="#202027"></ellipse></g></g><line x1="0" y1="0" x2="0" y2="48" stroke="#202027" stroke-width="22" stroke-linecap="round"></line></g><g transform="translate(-30 -14) rotate(-8.59)"><g transform="rotate(8.80)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="14" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(7.46)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="13" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(7.63)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="12" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(9.26)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="10.5" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(11.95)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="9" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(15.05)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="7.5" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(17.80)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="6" stroke-linecap="round"></line><g transform="translate(-10.6 0)"><g transform="rotate(19.52)"><line x1="0" y1="0" x2="-10.6" y2="0" stroke="#0a0a0d" stroke-width="4.5" stroke-linecap="round"></line><g transform="translate(-10.6 0)"></g></g></g></g></g></g></g></g></g></g></g></g></g></g></g></g></g><circle cx="0" cy="2" r="36" fill="#0a0a0d"></circle><ellipse cx="95" cy="6" rx="38" ry="41" fill="#0a0a0d"></ellipse><path d="M -4 -33 C 30 -40 62 -43 92 -35 L 97 46 C 76 32 40 26 -4 38 Z" fill="#0a0a0d"></path><g transform="translate(92 -22) rotate(48.13)"><line x1="0" y1="0" x2="0" y2="-56" stroke="#0a0a0d" stroke-width="40" stroke-linecap="round"></line><clipPath id="dogCollarClip"><rect x="-20" y="-70" width="40" height="90"></rect><ellipse cx="95" cy="6" rx="38" ry="41" transform="rotate(-48.13) translate(-92 22)"></ellipse></clipPath><g data-slot="collar">{{COLLAR}}</g><g data-slot="neck">{{NECK}}</g><g transform="translate(0 -62) rotate(0.02)"><path fill="url(#dogMouth)" visibility="visible" d="M 18 8 L 82 8 L 79 17.5 Q 73.0 22.3 73.7 27.1 L 61.0 24.0 L 45.4 20.2 L 29.8 16.2 L 18.0 13.7 Z"></path><path d="M 70 17 L 72.5 23 L 75 17.5 Z" fill="#f3efe6" visibility="visible"></path><g transform="rotate(8.02 20 14)"><path d="M 26 13 C 40 15 58 17 70 18 C 77 18.5 78 24 71 25.5 C 56 27.5 30 27 8 25 C 6 20 10 14 26 13 Z" fill="#0a0a0d"></path><g visibility="visible"><path d="M 30 10.5 C 42 9.2 56 10 64 12.5 C 69 14 70 17.5 66 18.3 C 58 18.2 48 16.2 38 14.4 C 34 13.8 31 12.6 30 10.5 Z" fill="#e06b80"></path><path d="M 36 12.2 C 46 12 56 12.8 63 14.6" fill="none" stroke="#b8475c" stroke-width="1.1" stroke-linecap="round"></path><path d="M 63.5 16.6 L 65.8 12 L 68 17 Z" fill="#f3efe6"></path></g></g><circle cx="0" cy="0" r="30" fill="#0a0a0d"></circle><path d="M 2 -27 C 12 -29 22 -25 28 -18 C 44 -16 64 -12 80 -10 C 88 -9 92 -1 89 6 C 87 13 82 18 74 18.5 C 64 19 52 16.5 40 15 C 30 14 18 16 6 18 Z" fill="#0a0a0d"></path><path d="M 40 15 C 52 16.5 64 19 75 18" fill="none" stroke="#34343f" stroke-width="2.2" stroke-linecap="round"></path><path d="M 40 15 q -3 -0.5 -4.5 -3" fill="none" stroke="#34343f" stroke-width="2" stroke-linecap="round"></path><ellipse cx="85" cy="-5" rx="8.5" ry="7" fill="#000"></ellipse><ellipse cx="83" cy="-8.5" rx="3.6" ry="1.8" fill="#5a5a66"></ellipse><path d="M 8 -20 Q 16 -24.5 25 -19.5" fill="none" stroke="#34343f" stroke-width="2.6" stroke-linecap="round"></path><g transform="translate(16 -9) scale(1 1.000)"><ellipse cx="0" cy="0" rx="6.8" ry="7.2" fill="#f4fff9"></ellipse><circle cx="2" cy="0.6" r="4.7" fill="#5b3a22"></circle><circle cx="2.3" cy="0.6" r="2.8" fill="#070709"></circle><circle cx="3.9" cy="-1.8" r="1.6" fill="#fff"></circle><circle cx="0.5" cy="2.6" r="0.8" fill="#fff" opacity="0.8"></circle></g><g transform="translate(-6 -20) rotate(4.05)"><path d="M 6 -2 C 14 2 14 14 10 24 C 6 38 0 50 -10 57 C -18 62 -27 56 -27 44 C -27 28 -22 10 -8 0 C -4 -3 2 -4 6 -2 Z" fill="url(#dogEar)"></path><path d="M 3 4 C -3 16 -9 30 -13 45" fill="none" stroke="#34343f" stroke-width="2" stroke-linecap="round" opacity="0.8"></path></g><g data-slot="hat">{{HAT}}</g></g></g><g transform="translate(6 14) rotate(35.52)"><ellipse cx="16" cy="4" rx="42" ry="34" transform="rotate(-16 16 4)" fill="#0a0a0d"></ellipse><g transform="translate(0 28.09)"><line x1="-6" y1="0" x2="46" y2="0" stroke="#32323c" stroke-width="21" stroke-linecap="round"></line><line x1="-6" y1="0" x2="46" y2="0" stroke="#0a0a0d" stroke-width="16" stroke-linecap="round"></line><ellipse cx="50" cy="1" rx="14" ry="8.5" fill="#0a0a0d" stroke="#32323c" stroke-width="2.5"></ellipse><path d="M 9.5 -4 L 10 1.5 M 14 -3 L 14.5 1.5" transform="translate(45 1)" stroke="#34343f" stroke-width="1.6" stroke-linecap="round" fill="none"></path></g><ellipse cx="16" cy="4" rx="40" ry="32" transform="rotate(-16 16 4)" fill="#0a0a0d"></ellipse><path d="M -24.15 3.77 A 41 33 -16 0 1 56.4 -1.62" fill="none" stroke="url(#dogHaunchRim)" stroke-width="2" stroke-linecap="round"></path></g><g transform="translate(100 18) rotate(55.34)"><g transform="translate(0 48) rotate(-56.47)"><line x1="0" y1="0" x2="0" y2="44" stroke="#32323c" stroke-width="20" stroke-linecap="round"></line><line x1="0" y1="0" x2="0" y2="44" stroke="#0a0a0d" stroke-width="15" stroke-linecap="round"></line><g transform="translate(0 44) rotate(36.66)"><ellipse cx="5" cy="0" rx="13" ry="8" fill="#0a0a0d" stroke="#32323c" stroke-width="2.5"></ellipse><path d="M 9.5 -4 L 10 1.5 M 14 -3 L 14.5 1.5" stroke="#34343f" stroke-width="1.6" stroke-linecap="round" fill="none"></path></g></g><line x1="0" y1="0" x2="0" y2="48" stroke="#0a0a0d" stroke-width="22" stroke-linecap="round"></line></g></g>`;

/** The collar and tag, for {{COLLAR}} (left out when the theme has neckwear). */
export const DOG_COLLAR = `<path d="M -20 -23 Q 0 -25.5 20 -33 L 20 -24 Q 0 -16 -20 -13 Z" fill="url(#dogCollar)"></path><path d="M -17 -21 Q 0 -23.45 17 -29.5" fill="none" stroke="#dcf8ec" stroke-width="2.2" stroke-linecap="round" opacity="0.55"></path><g transform="translate(14 -21.50) rotate(-12.61)"><circle cx="0" cy="0" r="2.4" fill="none" stroke="#2f7f63" stroke-width="1.4"></circle><circle cx="0" cy="7.8" r="5.8" fill="#c9f4e3" stroke="#2f7f63" stroke-width="1.4"></circle><circle cx="-1.8" cy="5.9" r="1.6" fill="#fff" opacity="0.75"></circle></g>`;

/** Centre of the held bone relative to the dog origin. */
export const DOG_MOUTH = [63.3, -134.6];

/** `hex` mixed toward white by `amount` (0..1). */
const tint = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, "0");
  return `#${mix(n >> 16)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
};

/**
 * Gradients and the coat-lighting filter the dog's markup refers to; the live
 * scene and the winner card both put this in their <defs>. The filter goes on
 * a group around the dog in dog-sized units (not flipped with the dog, so the
 * light stays overhead when it turns): a crisp rim along every top edge plus a
 * broad, faint sheen, both tinted by the spotlight colour `light`.
 */
export const dogDefs = (light) => {
  const rim = tint(light, 0.55);
  return `
  <filter id="dogCoat" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feOffset in="SourceAlpha" dy="3" result="rimShift"/>
    <feComposite in="SourceAlpha" in2="rimShift" operator="out" result="rimEdge"/>
    <feGaussianBlur in="rimEdge" stdDeviation="0.9" result="rimBlur"/>
    <feComposite in="rimBlur" in2="SourceAlpha" operator="in" result="rimMask"/>
    <feFlood flood-color="${rim}" flood-opacity="0.5"/>
    <feComposite in2="rimMask" operator="in" result="rim"/>
    <feOffset in="SourceAlpha" dy="16" result="sheenShift"/>
    <feComposite in="SourceAlpha" in2="sheenShift" operator="out" result="sheenEdge"/>
    <feGaussianBlur in="sheenEdge" stdDeviation="6" result="sheenBlur"/>
    <feComposite in="sheenBlur" in2="SourceAlpha" operator="in" result="sheenMask"/>
    <feFlood flood-color="${rim}" flood-opacity="0.13"/>
    <feComposite in2="sheenMask" operator="in" result="sheen"/>
    <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sheen"/><feMergeNode in="rim"/></feMerge>
  </filter>
  <linearGradient id="dogEar" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a2a34"/>
    <stop offset="1" stop-color="#111116"/>
  </linearGradient>
  <linearGradient id="dogCollar" gradientUnits="userSpaceOnUse" x1="-20" y1="0" x2="20" y2="0">
    <stop offset="0" stop-color="#3f9877"/>
    <stop offset="0.22" stop-color="#77ddaf"/>
    <stop offset="0.55" stop-color="#9ce9c8"/>
    <stop offset="0.85" stop-color="#77ddaf"/>
    <stop offset="1" stop-color="#4aa985"/>
  </linearGradient>
  <linearGradient id="dogMouth" gradientUnits="userSpaceOnUse" x1="34" y1="0" x2="80" y2="0">
    <stop offset="0" stop-color="#16070a"/>
    <stop offset="1" stop-color="#5a1a26"/>
  </linearGradient>
  <linearGradient id="dogHaunchRim" gradientUnits="userSpaceOnUse" x1="-24" y1="0" x2="44" y2="0">
    <stop offset="0.15" stop-color="#34343f" stop-opacity="0"/>
    <stop offset="0.75" stop-color="#34343f" stop-opacity="0.9"/>
  </linearGradient>`;
};
