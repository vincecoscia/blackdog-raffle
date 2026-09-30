import { useEffect, useRef } from "react";
import { BONE_ART, BONE_EMBOSS, BONE_INK, BONE_PATH, boneDefs } from "@/lib/bone";
import { dogCoatFilter, dogDefs } from "@/lib/card-dog";
import { sfx } from "@/lib/sound";
import {
  DEFAULT_MOON,
  HEART,
  LEAF,
  THEME_ART,
  batSvg,
  isTheme,
  beachBallSvg,
  cloverSvg,
  pumpkinSvg,
  themeForDate,
} from "@/lib/themes";

/**
 * The draw, as a 2D cartoon: a black dog sits in the spotlight next to a pile
 * of bones — one per teammate, their name printed on it. `draw(winner)`
 * shuffles the pile, then plays one of several routines (dig, go around the
 * back, fake-out, sniff-and-pounce, cannonball, zoomies) in which the dog
 * pulls a mystery bone out of the pile, carries it back, sits, and flips it
 * over to reveal the winner's name.
 *
 * The winner's bone never moves to a special place and the dig spot is random,
 * so nothing on screen hints at the result before the flip.
 *
 * Between draws the dog can be petted (click it) and bones poked. Sounds come
 * from lib/sound (recorded barks and clacks, plus synthesised effects).
 *
 * Everything is SVG, built and animated imperatively in one
 * requestAnimationFrame loop — React only provides the host element. The
 * engine hands { draw, reset } to the parent via `onReady` (this is loaded
 * through next/dynamic, which doesn't forward refs).
 */
export default function DogFetch({ participants, covered = false, onReady, onLanded, onSuspense }) {
  const host = useRef(null);
  const engine = useRef(null);
  const callbacks = useRef({ onReady, onLanded, onSuspense });

  useEffect(() => {
    callbacks.current = { onReady, onLanded, onSuspense };
  }, [onReady, onLanded, onSuspense]);

  useEffect(() => {
    const e = createEngine(host.current, callbacks);
    engine.current = e;
    callbacks.current.onReady?.({ draw: e.draw, reset: e.reset, theme: e.theme });
    return () => {
      e.dispose();
      engine.current = null;
      callbacks.current.onReady?.(null);
    };
  }, []);

  useEffect(() => {
    engine.current?.setParticipants(participants);
  }, [participants]);

  useEffect(() => {
    engine.current?.setCovered(covered);
  }, [covered]);

  return <div ref={host} className="absolute inset-0" style={BACKDROP} aria-hidden="true" />;
}

// The static backdrop (glow + faint dot grid) is plain CSS behind the SVG, and
// the SVG gets its own compositor layer: redrawing the animated dog then only
// repaints the scene itself, never the backdrop, the stage's inset shadow or
// the page around it. (Both were a big share of the work on phones.)
const BACKDROP = {
  background:
    "radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.06) 1.1px, transparent 1.3px) 0 0 / 26px 26px, " +
    "radial-gradient(75% 75% at 55% 42%, #10211b, #070709)",
};

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
const MINT = "#77ddaf"; // brand accent (same as lib/themes MINT)
const INK = "#0a0a0d"; // the dog
const INK_FAR = "#202027"; // far-side legs, a touch lighter for depth
const EDGE = "#32323c"; // hairline that separates near-side legs from the body
const DETAIL = "#34343f"; // brow, lip and toe lines
const FONT = "font-family: var(--font-bricolage), var(--font-inter), ui-sans-serif, sans-serif; font-weight: 800";

// ---------------------------------------------------------------------------
// Stage layout (SVG units; the ground is y = 0 and up is negative y)
// ---------------------------------------------------------------------------
const PILE_X = -330;
const PILE_HALF = 230;
const SPOT_X = 150; // where the dog sits, in the spotlight
const RUN_SPEED = 400;
const GRAVITY = 1500;
const MIN_BONES = 22; // pad small rosters with blank bones so the pile looks full
const BONE_REST = 26; // bone centre height when lying on the ground
const HOME_LEFT = PILE_X - PILE_HALF - 75;
const CAM_HOME = { x: HOME_LEFT, y: -300, w: SPOT_X + 330 - HOME_LEFT, h: 340 };
const VARIANTS = ["dig", "around", "fakeout", "sniffer", "cannonball", "zoomies"];

// ---------------------------------------------------------------------------
// Dog rig (dog-local units, facing +x; hips frame origin at the hip pivot)
// ---------------------------------------------------------------------------
const HIP_X = -50;
const SHOULDER = [92, -22];
const FRONT_ATTACH = [100, 18];
const REAR_ATTACH = [6, 14];
const FRONT_LEG = { L1: 48, L2: 44, W1: 22, W2: 15 };
const REAR_LEG = { L1: 48, L2: 46, W1: 30, W2: 16 };
const NECK_LEN = 62;
const CHEST = { cx: 95, cy: 6, rx: 38, ry: 41 }; // also the front of the throat
const TAG_AT = [14, -21.5]; // where the collar tag hangs, under the throat
const MOUTH = [46, 33]; // held-bone centre: in the mouth, under the upper lip
const NOSE = [86, -4];
const JAW_HINGE = [20, 14];
const JAW_MAX = 0.5; // radians, mouth wide open
const JAW_HOLD = 0.28; // how far open (0..1) while carrying a bone
// Mouth movement per sound: how wide (0..1) and how long it stays open (s).
const VOICES = {
  bark: { open: 0.8, hold: 0.14 },
  yip: { open: 0.5, hold: 0.05 },
  woof: { open: 0.95, hold: 0.12 },
  howl: { open: 0.75, hold: 1.25, lookUp: 1 },
  toss: { open: 0.75, hold: 0.12 },
};
const PAW_Y = -8;
const STRIDE = 22;
const LIFT = 16;
const GAIT_LENGTH = 80; // ground covered per full stride cycle
const TAIL_SEGMENTS = [14, 13, 12, 10.5, 9, 7.5, 6, 4.5]; // widths, base to tip
const TAIL_SEG_LEN = 10.6;
const TAIL_BEND = 5 / TAIL_SEGMENTS.length; // pose curl is tuned for a 5-segment tail
// Rim light, drawn just inside the top edges: back → chest (hips frame) and
// skull → brow → muzzle (head frame). Each gets a crisp line plus a faint
// wide band below it for sheen.
const BODY_RIM = "M -32.3 -9.8 A 34.4 34.4 0 0 1 0 -32.4 C 30 -38.4 62 -41.4 92 -33.3 A 36.4 39.4 0 0 1 126.5 -13.7";
const HEAD_RIM = "M -23.3 -16.3 A 28.4 28.4 0 0 1 14.2 -24.6 C 19 -24 24 -21 27.5 -16.6 C 44 -14.4 64 -10.4 79.5 -8.4";

// Poses are blended stand → sit and stand → dig.
//   hipH: hip height; p: torso pitch (negative lifts the chest);
//   n: neck angle from vertical (positive leans forward);
//   h: head angle (positive dips the snout); fdx/rdx: front/rear foot offset.
const POSES = {
  stand: { hipH: 104, p: 0, n: 0.72, h: 0.06, fdx: 6, rdx: 0, tail: 0.55, curl: 0.12 },
  sit: { hipH: 46, p: -0.62, n: 0.22, h: 0.1, fdx: 10, rdx: 44, tail: -0.15, curl: 0.38 },
  dig: { hipH: 108, p: 0.32, n: 1.5, h: 0.95, fdx: 26, rdx: -8, tail: 0.95, curl: 0.05 },
};
const POSE_KEYS = Object.keys(POSES.stand);

const STAR_PATH = "M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z";
const TOES = "M 9.5 -4 L 10 1.5 M 14 -3 L 14.5 1.5"; // on a paw centred at (5, 0)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
const el = (tag, attrs, parent) => {
  const node = document.createElementNS(NS, tag);
  if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
  parent?.appendChild(node);
  return node;
};
const deg = (r) => (r * 180) / Math.PI;
/** setAttribute, skipped when the value hasn't changed. */
const setAttr = (node, name, value) => {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const tf = (x, y, r = 0, sx = 1, sy = 1) =>
  `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg(r).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`;

const queryParam = (name) => {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
};

/**
 * Render quality. "rich" lights the dog's coat with an SVG filter; "lean" is
 * the same dog with drawn rim-light strokes. Lean from the start where the
 * filter is known to struggle: Safari paints SVG filters on the CPU, every
 * iPhone/iPad browser is Safari underneath, and phones can't afford it.
 * Desktop browsers start rich, and any that can't hold the frame rate drop to
 * lean by themselves (see the frame loop). `?quality=rich|lean` overrides it.
 */
function pickQuality() {
  const q = queryParam("quality");
  if (q === "rich" || q === "lean") return q;
  const ua = navigator.userAgent;
  const safari = /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg|OPR/.test(ua);
  const apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const phone = /Mobi|Android/.test(ua) || window.matchMedia("(pointer: coarse)").matches;
  return safari || apple || phone ? "lean" : "rich";
}

/** Seasonal skin by date (lib/themes CALENDAR); `?theme=<name>|none` overrides it for previews. */
function pickTheme() {
  const q = queryParam("theme");
  if (q === "none") return null;
  if (isTheme(q)) return q;
  return themeForDate(new Date());
}

/** Two-bone IK in the side plane. Angles: 0 = straight down, positive swings back. */
function ik(A, T, L1, L2, kneeForward) {
  let dx = T[0] - A[0];
  let dy = T[1] - A[1];
  let d = Math.hypot(dx, dy);
  const maxD = (L1 + L2) * 0.998;
  if (d > maxD) {
    dx *= maxD / d;
    dy *= maxD / d;
    d = maxD;
  }
  d = Math.max(d, Math.abs(L1 - L2) + 1);
  const theta = Math.atan2(-dx, dy);
  const alpha = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const upper = kneeForward ? theta - alpha : theta + alpha;
  const kx = A[0] - L1 * Math.sin(upper);
  const ky = A[1] + L1 * Math.cos(upper);
  const lower = Math.atan2(-(A[0] + dx - kx), A[1] + dy - ky);
  return { upper, lower };
}

function createEngine(host, callbacks) {
  const theme = pickTheme();
  let quality = pickQuality();
  const forcedVariant = VARIANTS.includes(queryParam("variant")) ? queryParam("variant") : null;

  // ---- svg + stage -----------------------------------------------------------
  // Three stacked SVG layers share the camera. The sky (spotlight, seasonal
  // rays, bats, fireworks, far particles) and the near particles each get their
  // own compositor layer, so things that move every frame only repaint
  // themselves — not the much heavier scene of bones and dog in between.
  const layer = (extraStyle = "") =>
    el("svg", { width: "100%", height: "100%", style: `position:absolute;inset:0;display:block;will-change:transform${extraStyle}` }, host);
  const skySvg = layer();
  const svg = layer();
  const nearSvg = layer(";pointer-events:none");
  el("style", {}, svg).textContent =
    '[data-part="dog"],[data-bone]{cursor:pointer}.df-busy [data-part="dog"],.df-busy [data-bone]{cursor:default}';
  const defs = el("defs", {}, svg);
  const radial = (id, stops, attrs = {}) => {
    const g = el("radialGradient", { id, ...attrs }, defs);
    for (const [o, c, a] of stops) el("stop", { offset: o, "stop-color": c, "stop-opacity": a }, g);
  };
  const moon = THEME_ART[theme]?.moon ?? DEFAULT_MOON;
  radial("dfMoon", moon.stops);
  defs.insertAdjacentHTML("beforeend", dogDefs(moon.ring) + boneDefs() + (quality === "rich" ? dogCoatFilter(moon.ring) : ""));
  radial("dfShadow", [
    ["0", "#000", 0.6],
    ["1", "#000", 0],
  ]);
  const floorGrad = el("linearGradient", { id: "dfFloor", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": MINT, "stop-opacity": 0.09 }, floorGrad);
  el("stop", { offset: 1, "stop-color": MINT, "stop-opacity": 0 }, floorGrad);

  const world = el("g", {}, svg);
  const sky = el("g", {}, skySvg);
  const near = el("g", {}, nearSvg);
  const worlds = [sky, world, near];
  const back = el("g", {}, world);
  el("circle", { cx: SPOT_X + 40, cy: -135, r: 215, fill: "url(#dfMoon)" }, sky);
  el("circle", {
    cx: SPOT_X + 40,
    cy: -135,
    r: 215,
    fill: "none",
    stroke: moon.ring,
    "stroke-opacity": 0.3,
    "stroke-width": 1.5,
    "vector-effect": "non-scaling-stroke",
  }, sky);
  el("rect", { x: -2000, y: 0, width: 4000, height: 500, fill: "url(#dfFloor)" }, back);
  el("line", {
    x1: -2000,
    x2: 2000,
    y1: 0,
    y2: 0,
    stroke: MINT,
    "stroke-opacity": 0.45,
    "stroke-width": 2,
    "vector-effect": "non-scaling-stroke",
  }, back);
  el("ellipse", { cx: PILE_X, cy: 3, rx: PILE_HALF + 50, ry: 14, fill: "url(#dfShadow)" }, back);
  const dogShadow = el("ellipse", { cx: SPOT_X, cy: 3, rx: 90, ry: 11, fill: "url(#dfShadow)" }, back);

  const propsLayer = el("g", {}, world);
  const pileLayer = el("g", {}, world);
  const dogLayer = el("g", {}, world);
  const frontLayer = el("g", {}, world);
  const fxLayer = el("g", {}, world);

  // ---- the dog ---------------------------------------------------------------
  let speedLinesOff = true;
  const speedLines = [0, 1, 2].map(() =>
    el("line", { stroke: MINT, "stroke-width": 2, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", opacity: 0 }, dogLayer)
  );
  // Rich: the coat filter, applied in world space outside the facing flip so
  // the light stays overhead. Lean: drawn rim-light strokes instead.
  const dogLit = el("g", quality === "rich" ? { filter: "url(#dogCoat)" } : {}, dogLayer);
  const dogRoot = el("g", { "data-part": "dog" }, dogLit);
  const rimParts = [];
  /** A rim-light line along `d`, with a faint sheen band just inside it (lean look). */
  const rimLight = (d, stroke, parent, { width = 2.3, sheen = 9, sheenDrop = 5.5 } = {}) => {
    const g = el("g", quality === "rich" ? { display: "none" } : {}, parent);
    if (sheen) {
      el("path", { d, transform: `translate(0 ${sheenDrop})`, fill: "none", stroke, "stroke-width": sheen, "stroke-linecap": "round", "stroke-opacity": 0.07 }, g);
    }
    el("path", { d, fill: "none", stroke, "stroke-width": width, "stroke-linecap": "round", "stroke-opacity": 0.5 }, g);
    rimParts.push(g);
  };
  /** Swap the rich coat filter for the lean drawn rim light, for good. */
  const goLean = () => {
    if (quality === "lean") return;
    quality = "lean";
    dogLit.removeAttribute("filter");
    for (const g of rimParts) g.removeAttribute("display");
  };
  const hips = el("g", {}, dogRoot);

  // Near-side lower legs and paws get a hairline edge so near and far legs
  // read as separate against each other and the (equally black) body.
  const buildLeg = (attach, dims, color, edge = false) => {
    const top = el("g", {}, hips);
    const knee = el("g", { transform: `translate(0 ${dims.L1})` }, top);
    if (edge) el("line", { x1: 0, y1: 0, x2: 0, y2: dims.L2, stroke: EDGE, "stroke-width": dims.W2 + 5, "stroke-linecap": "round" }, knee);
    el("line", { x1: 0, y1: 0, x2: 0, y2: dims.L2, stroke: color, "stroke-width": dims.W2, "stroke-linecap": "round" }, knee);
    const paw = el("g", { transform: `translate(0 ${dims.L2})` }, knee);
    el("ellipse", { cx: 5, cy: 0, rx: 13, ry: 8, fill: color, ...(edge ? { stroke: EDGE, "stroke-width": 2.5 } : {}) }, paw);
    if (edge) el("path", { d: TOES, stroke: DETAIL, "stroke-width": 1.6, "stroke-linecap": "round", fill: "none" }, paw);
    // Thigh on top of the lower leg so the knee reads.
    el("line", { x1: 0, y1: 0, x2: 0, y2: dims.L1, stroke: color, "stroke-width": dims.W1, "stroke-linecap": "round" }, top);
    return { top, knee, paw, attach, dims };
  };

  // Draw order: far legs, tail, body, neck + head, near legs.
  const farRear = buildLeg(REAR_ATTACH, REAR_LEG, INK_FAR);
  const farFront = buildLeg(FRONT_ATTACH, FRONT_LEG, INK_FAR);
  const tailRoot = el("g", { transform: "translate(-30 -14)" }, hips);
  const tail = [];
  let tailParent = tailRoot;
  for (const w of TAIL_SEGMENTS) {
    const seg = el("g", {}, tailParent);
    el("line", { x1: 0, y1: 0, x2: -TAIL_SEG_LEN, y2: 0, stroke: INK, "stroke-width": w, "stroke-linecap": "round" }, seg);
    const next = el("g", { transform: `translate(${-TAIL_SEG_LEN} 0)` }, seg);
    tail.push(seg);
    tailParent = next;
  }
  el("circle", { cx: 0, cy: 2, r: 36, fill: INK }, hips);
  el("ellipse", { ...CHEST, fill: INK }, hips);
  el("path", { d: "M -4 -33 C 30 -40 62 -43 92 -35 L 97 46 C 76 32 40 26 -4 38 Z", fill: INK }, hips);
  rimLight(BODY_RIM, "url(#dogRimBody)", hips);

  const neck = el("g", {}, hips);
  el("line", { x1: 0, y1: 0, x2: 0, y2: -NECK_LEN + 6, stroke: INK, "stroke-width": 40, "stroke-linecap": "round" }, neck);
  rimLight("M -18.4 -6 L -18.4 -50", "url(#dogRimNeck)", neck, { width: 2, sheen: 0 });
  // Seasonal neckwear can wrap a band round the neck with this clip: the neck
  // plus the chest (which forms the front of the throat), so its ends always
  // meet the outline.
  const collarClip = el("clipPath", { id: "dogCollarClip" }, neck);
  el("rect", { x: -20, y: -70, width: 40, height: 90 }, collarClip);
  const collarChest = el("ellipse", CHEST, collarClip);
  // The collar goes round the narrowest part of the neck: exactly as wide as
  // the neck, so both ends meet the outline, rising from the nape into the
  // throat just under the jaw. Neckwear replaces it.
  const collar = el("g", { "data-slot": "collar" }, neck);
  el("path", { d: "M -20 -23 Q 0 -25.5 20 -33 L 20 -24 Q 0 -16 -20 -13 Z", fill: "url(#dogCollar)" }, collar);
  el("path", { d: "M -17 -21 Q 0 -23.45 17 -29.5", fill: "none", stroke: "#dcf8ec", "stroke-width": 2.2, "stroke-linecap": "round", opacity: 0.55 }, collar);
  // The tag hangs straight down from the collar and swings as he trots.
  const tag = el("g", {}, collar);
  el("circle", { cx: 0, cy: 0, r: 2.4, fill: "none", stroke: "#2f7f63", "stroke-width": 1.4 }, tag);
  el("circle", { cx: 0, cy: 7.8, r: 5.8, fill: "#c9f4e3", stroke: "#2f7f63", "stroke-width": 1.4 }, tag);
  el("circle", { cx: -1.8, cy: 5.9, r: 1.6, fill: "#fff", opacity: 0.75 }, tag);
  const neckSlot = el("g", { "data-slot": "neck" }, neck); // seasonal neckwear goes over the collar
  // Head: skull at the origin, a brow over the eye, then a deep hound muzzle
  // with the nose on top and soft flews hanging under it.
  const head = el("g", {}, neck);
  // The lower jaw swings open from a hinge under the eye, showing the inside of
  // the mouth (redrawn each frame to fill the gap), a tongue and two canines.
  // All of that sits behind the lips and is hidden outright while the mouth is
  // shut, so no red edge shows at the lips.
  const mouthInside = el("path", { fill: "url(#dogMouth)" }, head);
  const upperFang = el("path", { d: "M 70 17 L 72.5 23 L 75 17.5 Z", fill: "#f3efe6" }, head);
  const jaw = el("g", {}, head);
  el("path", {
    d: "M 26 13 C 40 15 58 17 70 18 C 77 18.5 78 24 71 25.5 C 56 27.5 30 27 8 25 C 6 20 10 14 26 13 Z",
    fill: INK,
  }, jaw);
  const tongue = el("g", {}, jaw);
  el("path", {
    d: "M 30 10.5 C 42 9.2 56 10 64 12.5 C 69 14 70 17.5 66 18.3 C 58 18.2 48 16.2 38 14.4 C 34 13.8 31 12.6 30 10.5 Z",
    fill: "#e06b80",
  }, tongue);
  el("path", { d: "M 36 12.2 C 46 12 56 12.8 63 14.6", fill: "none", stroke: "#b8475c", "stroke-width": 1.1, "stroke-linecap": "round" }, tongue);
  el("path", { d: "M 63.5 16.6 L 65.8 12 L 68 17 Z", fill: "#f3efe6" }, tongue);
  const mouthParts = [mouthInside, upperFang, tongue];
  let mouthShown = null;
  el("circle", { cx: 0, cy: 0, r: 30, fill: INK }, head);
  el("path", {
    d: "M 2 -27 C 12 -29 22 -25 28 -18 C 44 -16 64 -12 80 -10 C 88 -9 92 -1 89 6 C 87 13 82 18 74 18.5 C 64 19 52 16.5 40 15 C 30 14 18 16 6 18 Z",
    fill: INK,
  }, head);
  el("path", { d: "M 40 15 C 52 16.5 64 19 75 18", fill: "none", stroke: DETAIL, "stroke-width": 2.2, "stroke-linecap": "round" }, head);
  el("path", { d: "M 40 15 q -3 -0.5 -4.5 -3", fill: "none", stroke: DETAIL, "stroke-width": 2, "stroke-linecap": "round" }, head);
  rimLight(HEAD_RIM, "url(#dogRimHead)", head, { width: 2.1, sheen: 8, sheenDrop: 4.5 });
  el("ellipse", { cx: 85, cy: -5, rx: 8.5, ry: 7, fill: "#000" }, head);
  el("ellipse", { cx: 83, cy: -8.5, rx: 3.6, ry: 1.8, fill: "#5a5a66" }, head);
  el("path", { d: "M 8 -20 Q 16 -24.5 25 -19.5", fill: "none", stroke: DETAIL, "stroke-width": 2.6, "stroke-linecap": "round" }, head);
  const eye = el("g", {}, head);
  el("ellipse", { cx: 0, cy: 0, rx: 6.8, ry: 7.2, fill: "#f4fff9" }, eye);
  el("circle", { cx: 2, cy: 0.6, r: 4.7, fill: "#5b3a22" }, eye);
  el("circle", { cx: 2.3, cy: 0.6, r: 2.8, fill: "#070709" }, eye);
  el("circle", { cx: 3.9, cy: -1.8, r: 1.6, fill: "#fff" }, eye);
  el("circle", { cx: 0.5, cy: 2.6, r: 0.8, fill: "#fff", opacity: 0.8 }, eye);
  // A hound ear with a soft fold, hanging from the back of the skull.
  const ear = el("g", {}, head);
  el("path", {
    d: "M 6 -2 C 14 2 14 14 10 24 C 6 38 0 50 -10 57 C -18 62 -27 56 -27 44 C -27 28 -22 10 -8 0 C -4 -3 2 -4 6 -2 Z",
    fill: "url(#dogEar)",
  }, ear);
  el("path", { d: "M 3 4 C -3 16 -9 30 -13 45", fill: "none", stroke: DETAIL, "stroke-width": 2, "stroke-linecap": "round", opacity: 0.8 }, ear);
  const hatSlot = el("g", { "data-slot": "hat" }, head);

  const nearRear = buildLeg(REAR_ATTACH, REAR_LEG, INK, true);

  // A two-joint leg can't fold the way a sitting dog's hind leg does, so the
  // sitting pose swaps in dedicated artwork (as in the logo): a rounded haunch
  // with the hind foot lying forward on the ground. Kept upright in world
  // space and cross-faded with the jointed hind legs as the dog sits.
  const haunch = el("g", { opacity: 0 }, hips);
  el("ellipse", { cx: 16, cy: 4, rx: 42, ry: 34, transform: "rotate(-16 16 4)", fill: INK }, haunch);
  const hindFoot = el("g", {}, haunch);
  el("line", { x1: -6, y1: 0, x2: 46, y2: 0, stroke: EDGE, "stroke-width": 21, "stroke-linecap": "round" }, hindFoot);
  el("line", { x1: -6, y1: 0, x2: 46, y2: 0, stroke: INK, "stroke-width": 16, "stroke-linecap": "round" }, hindFoot);
  el("ellipse", { cx: 50, cy: 1, rx: 14, ry: 8.5, fill: INK, stroke: EDGE, "stroke-width": 2.5 }, hindFoot);
  el("path", { d: TOES, transform: "translate(45 1)", stroke: DETAIL, "stroke-width": 1.6, "stroke-linecap": "round", fill: "none" }, hindFoot);
  // Re-cover the top of the foot with the thigh so it tucks under the haunch,
  // then light the front of the thigh (fading out towards the tail) so it
  // reads against the body.
  el("ellipse", { cx: 16, cy: 4, rx: 40, ry: 32, transform: "rotate(-16 16 4)", fill: INK }, haunch);
  el("path", {
    d: "M -24.15 3.77 A 41 33 -16 0 1 56.4 -1.62",
    fill: "none",
    stroke: "url(#dogHaunchRim)",
    "stroke-width": 2,
    "stroke-linecap": "round",
  }, haunch);

  const nearFront = buildLeg(FRONT_ATTACH, FRONT_LEG, INK, true);
  // Trot: diagonal pairs move together.
  const legs = [
    { leg: farRear, front: false, offset: 0, dx: 8 },
    { leg: farFront, front: true, offset: Math.PI, dx: 8, far: true },
    { leg: nearRear, front: false, offset: Math.PI, dx: 0 },
    { leg: nearFront, front: true, offset: 0, dx: 0 },
  ];

  const dog = {
    x: SPOT_X,
    y: 0,
    facing: 1,
    sit: 1,
    dig: 0,
    gait: 0,
    phase: 0,
    speed: 0,
    scratch: 0,
    scratchPhase: 0,
    extraNeck: 0,
    extraHead: 0,
    tilt: 0,
    lean: 0,
    air: 0, // 0..1 legs stretched out mid-jump
    sniff: 0, // 0..1 nose to the ground
    pawUp: 0, // 0..1 pointer pose: near front paw raised
    tailStiff: 0, // 0..1 pointer pose: tail straight out
    wiggle: 0, // 0..1 play-bow butt wiggle
    squash: 0, // landing squash, decays
    turnPulse: 0, // stretch while turning around
    wagSpeed: 3,
    wagAmp: 0.15,
    ear: 0.1,
    blink: 0,
    jaw: 0, // 0..1 mouth open
    chomp: 0, // 0..1 mouth wide open to grab a bone
    lookUp: 0, // 0..1 head thrown back (howling)
    mouth: [0, 0],
    nose: [0, 0],
    headTop: [0, 0],
  };

  const solveDog = (clock) => {
    const P = {};
    for (const k of POSE_KEYS) P[k] = lerp(lerp(POSES.stand[k], POSES.sit[k], dog.sit), POSES.dig[k], dog.dig);
    const breathe = Math.sin(clock * 2.2) * 1.5 * (1 - dog.gait);
    const hipH = P.hipH + Math.sin(dog.phase * 2) * 4 * dog.gait - 4 * dog.lean + breathe;
    const p = P.p + 0.06 * dog.lean + 0.06 * Math.sin(clock * 22) * dog.wiggle;
    const cp = Math.cos(p);
    const sp = Math.sin(p);
    const toRoot = ([lx, ly]) => [HIP_X + lx * cp - ly * sp, -hipH + lx * sp + ly * cp];
    hips.setAttribute("transform", tf(HIP_X, -hipH, p));

    // Sitting: jointed hind legs out, haunch artwork in.
    const sitVis = clamp((dog.sit - 0.55) / 0.35, 0, 1);
    farRear.top.setAttribute("opacity", (1 - sitVis).toFixed(2));
    nearRear.top.setAttribute("opacity", (1 - sitVis).toFixed(2));
    haunch.setAttribute("opacity", sitVis.toFixed(2));
    if (sitVis > 0) {
      const H = toRoot(REAR_ATTACH);
      haunch.setAttribute("transform", tf(REAR_ATTACH[0], REAR_ATTACH[1], -p));
      hindFoot.setAttribute("transform", `translate(0 ${(PAW_Y - 1 - H[1]).toFixed(2)})`);
    }

    for (const { leg, front, offset, dx, far } of legs) {
      const A = toRoot(leg.attach);
      let tx = A[0] + (front ? P.fdx : P.rdx) + dx;
      let ty = PAW_Y;
      if (dog.gait > 0) {
        const ph = dog.phase + offset;
        tx += STRIDE * Math.sin(ph) * dog.gait;
        ty -= LIFT * Math.max(0, Math.cos(ph)) * dog.gait;
      }
      if (front && dog.scratch > 0) {
        const ph = dog.scratchPhase + (far ? Math.PI : 0);
        tx += 26 * Math.sin(ph) * dog.scratch;
        ty -= 22 * Math.max(0, Math.cos(ph)) * dog.scratch;
      }
      if (dog.air > 0) {
        tx += (front ? 30 : -34) * dog.air;
        ty -= (front ? 16 : 12) * dog.air;
      }
      if (front && !far && dog.pawUp > 0) {
        tx -= 14 * dog.pawUp;
        ty -= 38 * dog.pawUp;
      }
      const { upper, lower } = ik(A, [tx, ty], leg.dims.L1, leg.dims.L2, !front);
      leg.top.setAttribute("transform", tf(leg.attach[0], leg.attach[1], upper - p));
      leg.knee.setAttribute("transform", tf(0, leg.dims.L1, lower - upper));
      leg.paw.setAttribute("transform", tf(0, leg.dims.L2, -lower));
    }

    const neckW = P.n + dog.extraNeck + 0.55 * dog.sniff - 0.3 * dog.lookUp;
    const headW = P.h + dog.extraHead + dog.tilt + 0.5 * dog.sniff - 0.75 * dog.lookUp;
    neck.setAttribute("transform", tf(SHOULDER[0], SHOULDER[1], neckW - p));
    collarChest.setAttribute("transform", `rotate(${deg(p - neckW).toFixed(2)}) translate(${-SHOULDER[0]} ${-SHOULDER[1]})`);
    const swing = 0.35 * Math.sin(dog.phase * 2) * dog.gait + 0.25 * Math.sin(dog.scratchPhase * 2) * dog.scratch;
    tag.setAttribute("transform", tf(TAG_AT[0], TAG_AT[1], swing - neckW));
    head.setAttribute("transform", tf(0, -NECK_LEN, headW - neckW));
    const S = toRoot(SHOULDER);
    const hp = [S[0] + NECK_LEN * Math.sin(neckW), S[1] - NECK_LEN * Math.cos(neckW)];
    const m = rot(MOUTH[0], MOUTH[1], headW);
    const n = rot(NOSE[0], NOSE[1], headW);
    dog.mouth = [hp[0] + m[0], hp[1] + m[1]];
    dog.nose = [hp[0] + n[0], hp[1] + n[1]];
    dog.headTop = [hp[0] + 10, hp[1] - (theme ? 110 : 70)];

    eye.setAttribute("transform", `translate(16 -9) scale(1 ${(1 - dog.blink * 0.88).toFixed(3)})`);
    const shown = dog.jaw > 0.02;
    if (shown !== mouthShown) {
      mouthShown = shown;
      for (const part of mouthParts) part.setAttribute("visibility", shown ? "visible" : "hidden");
    }
    const ja = shown ? dog.jaw * JAW_MAX : 0;
    setAttr(jaw, "transform", `rotate(${deg(ja).toFixed(2)} ${JAW_HINGE[0]} ${JAW_HINGE[1]})`);
    if (shown) {
      const jp = (x, y) => {
        const [rx, ry] = rot(x - JAW_HINGE[0], y - JAW_HINGE[1], ja);
        return `${(JAW_HINGE[0] + rx).toFixed(1)} ${(JAW_HINGE[1] + ry).toFixed(1)}`;
      };
      // From inside the muzzle to the front of the flews, a curve set back
      // between the lips (so the opening reads as a notch, not a slab) to the
      // tip of the lower jaw, then back just under its top edge (the jaw hides
      // the overlap, so no gap opens at the corner of the mouth).
      const [tx, ty] = rot(75 - JAW_HINGE[0], 19.5 - JAW_HINGE[1], ja);
      const curveX = (79 + JAW_HINGE[0] + tx) / 2 - 12 * dog.jaw;
      const curveY = (17.5 + JAW_HINGE[1] + ty) / 2;
      mouthInside.setAttribute(
        "d",
        `M 18 8 L 82 8 L 79 17.5 Q ${curveX.toFixed(1)} ${curveY.toFixed(1)} ${jp(75, 19.5)} L ${jp(62, 18.2)} L ${jp(46, 16.6)} L ${jp(30, 14.8)} L ${jp(18, 14)} Z`
      );
    }
    ear.setAttribute("transform", tf(-6, -20, dog.ear));
    tailRoot.setAttribute("transform", tf(-30, -14, lerp(P.tail, 0.08, dog.tailStiff)));
    const curl = lerp(P.curl, 0, dog.tailStiff);
    const wagAmp = dog.wagAmp * (1 - dog.tailStiff);
    tail.forEach((seg, i) => {
      const wag = wagAmp * Math.sin(clock * dog.wagSpeed - i * 0.8 * TAIL_BEND) * 0.5;
      seg.setAttribute("transform", `rotate(${deg((curl + wag) * TAIL_BEND).toFixed(2)})`);
    });
    const sx = 1 + 0.06 * dog.squash;
    const sy = (1 + 0.07 * dog.turnPulse) * (1 - 0.1 * dog.squash);
    dogRoot.setAttribute(
      "transform",
      `translate(${dog.x.toFixed(2)} ${dog.y.toFixed(2)}) scale(${(dog.facing * sx).toFixed(3)} ${sy.toFixed(3)})`
    );

    dogShadow.setAttribute("cx", (dog.x - dog.facing * 12).toFixed(1));
    dogShadow.setAttribute("rx", (96 - 26 * dog.sit).toFixed(1));
    dogShadow.setAttribute("opacity", clamp(1 + dog.y / 120, 0.2, 1).toFixed(2));

    // Speed lines trail the dog while it runs.
    const s = clamp((dog.speed - 150) / 250, 0, 1);
    if (s === 0 && speedLinesOff) return;
    speedLinesOff = s === 0;
    speedLines.forEach((line, i) => {
      const y = dog.y - 58 - i * 26;
      const x0 = dog.x - dog.facing * (95 + i * 14);
      line.setAttribute("x1", x0.toFixed(1));
      line.setAttribute("x2", (x0 - dog.facing * (40 + i * 10)).toFixed(1));
      line.setAttribute("y1", y.toFixed(1));
      line.setAttribute("y2", y.toFixed(1));
      line.setAttribute("opacity", (s * (0.55 - i * 0.12)).toFixed(2));
    });
  };

  /** Dog-local point → world. */
  const toWorld = ([lx, ly]) => [dog.x + dog.facing * lx, dog.y + ly];
  const setDogBehindPile = (behind) => world.insertBefore(dogLayer, behind ? pileLayer : frontLayer);

  // ---- bones -----------------------------------------------------------------
  let bones = [];
  let pending = null;
  let labelMap = new Map();

  const labelsFor = (list) => {
    const counts = {};
    for (const p of list) counts[p.firstName] = (counts[p.firstName] ?? 0) + 1;
    return new Map(
      list.map((p) => [p._id, counts[p.firstName] > 1 && p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName])
    );
  };

  /** Shrink a long name to fit the shaft (measured at full size, so it can re-run once fonts load). */
  const fitLabel = (label) => {
    try {
      label.style.fontSize = "17px";
      const len = label.lastChild.getComputedTextLength();
      if (len > 92) label.style.fontSize = `${(17 * 92) / len}px`;
    } catch {
      /* not rendered yet */
    }
  };

  /**
   * Lettering on a bone. `stamped` adds a light copy just below the ink so it
   * looks pressed in; that doubles the text drawn, so only the bone that gets
   * presented up close has it (at pile size it's invisible anyway).
   */
  const letter = (parent, content, size, y, { stamped = false, ...attrs } = {}) => {
    const g = el("g", { style: `${FONT}; font-size: ${size}px`, ...attrs }, parent);
    const layers = stamped ? [[1.1, BONE_EMBOSS, 0.9], [0, BONE_INK, 1]] : [[0, BONE_INK, 1]];
    for (const [dy, fill, alpha] of layers) {
      el("text", { x: 0, y: y + dy, "text-anchor": "middle", "dominant-baseline": "central", fill, "fill-opacity": alpha }, g).textContent = content;
    }
    return g;
  };

  const boneByNode = new WeakMap();
  const makeBone = (id, label, { stamped = false } = {}) => {
    const g = el("g", { "data-bone": "" }, pileLayer);
    const glow = el("path", { d: BONE_PATH, fill: "none", stroke: MINT, "stroke-width": 12, "stroke-linejoin": "round", opacity: 0 }, g);
    g.insertAdjacentHTML("beforeend", BONE_ART);
    let text = null;
    let mystery = null;
    if (label) {
      text = letter(g, label, 17, 1.5, { stamped });
      fitLabel(text);
      document.fonts?.ready.then(() => fitLabel(text));
      mystery = letter(g, "?", 24, 2, { stamped, opacity: 0 });
    } else {
      // Blank bones get a paw print.
      const paw = el("g", { fill: "#cbb58c", transform: "translate(0 1) scale(0.8)" }, g);
      el("ellipse", { cx: 0, cy: 3, rx: 7, ry: 6 }, paw);
      for (const [x, y] of [[-8, -4], [-3, -8.5], [3, -8.5], [8, -4]]) el("circle", { cx: x, cy: y, r: 3 }, paw);
    }
    const bone = { id, g, glow, text, mystery, x: 0, y: -BONE_REST, r: 0, sx: 1, vx: 0, vy: 0, vr: 0, mode: "rest" };
    boneByNode.set(g, bone);
    return bone;
  };

  const placeBone = (b, jx = 0, jy = 0) => b.g.setAttribute("transform", tf(b.x + jx, b.y + jy, b.r, b.sx, 1));
  const setMystery = (b, on) => {
    b.text?.setAttribute("opacity", on ? 0 : 1);
    b.mystery?.setAttribute("opacity", on ? 1 : 0);
  };

  /**
   * Stack bones into a mound with a 1D height map: each bone tries a few
   * spots, favouring low ones near the middle, rests on the highest point
   * under it and tilts to follow the slope.
   */
  const HM_X0 = PILE_X - PILE_HALF - 90;
  const HM_CELL = 6;
  const HM_N = Math.ceil((2 * PILE_HALF + 180) / HM_CELL);
  const hmIdx = (x) => clamp(Math.round((x - HM_X0) / HM_CELL), 0, HM_N - 1);
  const layoutHeap = (list) => {
    const hm = new Float32Array(HM_N);
    const restOn = (cx, r) => {
      const half = 63 * Math.abs(Math.cos(r)) + 26 * Math.abs(Math.sin(r));
      const i0 = hmIdx(cx - half);
      const im = hmIdx(cx);
      const i1 = hmIdx(cx + half);
      let hL = 0;
      let hR = 0;
      for (let k = i0; k <= im; k++) hL = Math.max(hL, hm[k]);
      for (let k = im; k <= i1; k++) hR = Math.max(hR, hm[k]);
      const base = Math.max(hL, hR) - Math.abs(hR - hL) * 0.35;
      return { half, i0, i1, hL, hR, base: Math.max(base, BONE_REST - 9) };
    };
    const order = [...list].sort(() => Math.random() - 0.5);
    order.forEach((b, i) => {
      let best = null;
      for (let c = 0; c < 6; c++) {
        const x = PILE_X + rand(-1, 1) * PILE_HALF * 0.82;
        const score = restOn(x, 0).base + Math.abs(x - PILE_X) * 0.3;
        if (!best || score < best.score) best = { x, score };
      }
      const cx = best.x;
      const rest = restOn(cx, rand(-0.5, 0.5));
      const r = clamp(-Math.atan2(rest.hR - rest.hL, 2 * rest.half) * 0.9 + rand(-0.18, 0.18), -0.7, 0.7);
      // Bones nestle into the gaps (they're at different depths in the
      // pile), so each only adds about a third of its height.
      const centerH = rest.base + 9;
      for (let k = rest.i0; k <= rest.i1; k++) {
        const x = HM_X0 + k * HM_CELL;
        hm[k] = Math.max(hm[k], centerH + 8 - (x - cx) * Math.tan(r));
      }
      b.slot = { x: cx, y: -centerH, r, order: i };
    });
    return order;
  };

  const rebuildBones = (list) => {
    for (const b of bones) b.g.remove();
    labelMap = labelsFor(list);
    bones = list.map((p) => makeBone(p._id, labelMap.get(p._id)));
    for (let i = list.length; i < MIN_BONES; i++) bones.push(makeBone(`blank-${i}`, null));
    for (const b of layoutHeap(bones)) {
      Object.assign(b, { x: b.slot.x, y: b.slot.y, r: b.slot.r, mode: "rest" });
      pileLayer.appendChild(b.g);
      placeBone(b);
    }
  };

  // ---- effects ---------------------------------------------------------------
  const puffs = Array.from({ length: 48 }, () => ({
    node: el("circle", { r: 0, fill: "#d7e8df", opacity: 0 }, fxLayer),
    life: 0,
  }));
  const puff = (x, y, vx, vy, size = rand(4, 7)) => {
    const p = puffs.find((q) => q.life <= 0);
    if (!p) return;
    Object.assign(p, { x, y, vx, vy, life: 1, size });
  };
  const sparkles = Array.from({ length: 14 }, () => ({
    node: el("path", { d: STAR_PATH, fill: MINT, opacity: 0 }, fxLayer),
    life: 0,
  }));
  const hearts = Array.from({ length: 8 }, () => ({
    node: el("path", { d: HEART, fill: "#ff7aa8", opacity: 0 }, fxLayer),
    life: 0,
  }));
  const heart = () => {
    const h = hearts.find((q) => q.life <= 0);
    if (!h) return;
    const [hx, hy] = toWorld(dog.headTop);
    Object.assign(h, { x: hx + rand(-24, 24), y: hy + 40, life: 1, drift: rand(-25, 25) });
  };
  const sparkle = (x, y) => {
    const s = sparkles.find((q) => q.life <= 0);
    if (!s) return;
    Object.assign(s, { x, y, life: 1, spin: rand(-3, 3), size: rand(0.6, 1.3) });
    s.node.setAttribute("fill", Math.random() < 0.35 ? "#ffffff" : MINT);
  };
  const bang = el("text", {
    "text-anchor": "middle",
    "dominant-baseline": "central",
    fill: MINT,
    opacity: 0,
    style: `${FONT}; font-size: 54px`,
  }, fxLayer);
  let bangT = -1;
  let talks = [];
  /** Move the mouth with a sound (`delay` lines it up with a delayed one). */
  const say = (kind, delay = 0) => talks.push({ ...VOICES[kind], t: -delay });
  /** Bark, yip, woof or howl, mouth and all. */
  const voice = (kind, opts = {}) => {
    sfx[kind](opts);
    say(kind, opts.delay ?? 0);
  };
  const pop = (char) => {
    bang.textContent = char;
    bang.setAttribute("fill", char === "?" ? "#ffffff" : MINT);
    bangT = 0;
    if (char === "?") sfx.whine();
    else sfx.ting();
  };

  let lastClack = 0;
  const clack = (v) => {
    const now = performance.now();
    if (now - lastClack < 35) return;
    lastClack = now;
    sfx.clack(clamp(v, 0.1, 1));
  };

  // Seasonal hat/neckwear (shared with the winner card) + the scene's own effects.
  hatSlot.innerHTML = THEME_ART[theme]?.hat ?? "";
  neckSlot.innerHTML = THEME_ART[theme]?.neck ?? "";
  if (THEME_ART[theme]?.neck) collar.remove();
  const swaying = [...dogRoot.querySelectorAll("[data-sway]")].map((node) => {
    const [lean, amp, speed, phase] = node.getAttribute("data-sway").split(" ").map(Number);
    return { node, lean, amp, speed, phase };
  });
  const sceneFx = SCENES[theme]?.({ sky, near, propsLayer, moonCenter: [SPOT_X + 40, -135] });
  const themeFx = {
    update(dt, clock) {
      for (const w of swaying) {
        w.node.setAttribute("transform", `rotate(${deg(w.lean + w.amp * Math.sin(clock * w.speed + w.phase)).toFixed(2)})`);
      }
      sceneFx?.(dt, clock);
    },
  };

  // ---- camera ------------------------------------------------------------------
  let vw = 1;
  let vh = 1;
  const cam = { s: 1, cx: 0, cy: 0, shake: 0, ready: false };
  let camMode = "home"; // home | present

  const camTarget = () => {
    let rect = CAM_HOME;
    let focus = dog.x - 90;
    if (camMode === "present") {
      rect = { x: SPOT_X - 135, y: -285, w: 290, h: 300 };
      focus = SPOT_X + 10;
    } else if (mode === "busy") {
      // Frame the pile and wherever the dog is right now.
      const left = Math.min(PILE_X - PILE_HALF - 50, dog.x - 200);
      const right = Math.max(PILE_X + PILE_HALF + 80, dog.x + 210);
      // Open up when the dog is airborne so jumps stay in frame.
      const top = Math.min(-300, dog.y - 250);
      rect = { x: left, y: top, w: right - left, h: 40 - top };
      focus = dog.x;
    }
    const sH = vh / rect.h;
    let s = Math.min(sH, vw / rect.w);
    let cx = rect.x + rect.w / 2;
    let cy = rect.y + rect.h / 2;
    // Narrow screens: don't shrink the stage to a postage stamp — zoom in,
    // follow the action, and sit the ground low in the frame.
    const minS = sH * 0.45;
    if (s < minS) {
      s = minS;
      const half = vw / s / 2;
      cx = clamp(focus, rect.x + half, rect.x + rect.w - half);
      if (camMode !== "present") cy = Math.min(cy, -0.27 * (vh / s));
    }
    return { s, cx, cy };
  };

  const updateCamera = (dt) => {
    const t = camTarget();
    if (!cam.ready) {
      Object.assign(cam, t, { ready: true });
    } else {
      const k = 1 - Math.exp(-dt * 2.6);
      cam.s = Math.exp(lerp(Math.log(cam.s), Math.log(t.s), k));
      cam.cx = lerp(cam.cx, t.cx, k);
      cam.cy = lerp(cam.cy, t.cy, k);
    }
    cam.shake = Math.max(0, cam.shake - dt * 2.5);
    const jx = cam.shake ? (rand(-1, 1) * 9 * cam.shake) / cam.s : 0;
    const jy = cam.shake ? (rand(-1, 1) * 9 * cam.shake) / cam.s : 0;
    // Rounded so a settled camera stops changing (moving the world repaints
    // the whole scene).
    const view = `translate(${(vw / 2 - (cam.cx + jx) * cam.s).toFixed(1)} ${(vh / 2 - (cam.cy + jy) * cam.s).toFixed(1)}) scale(${cam.s.toFixed(4)})`;
    for (const w of worlds) setAttr(w, "transform", view);
  };

  // ---- timeline primitives -------------------------------------------------------
  let wake = () => {}; // restarts the frame loop if it's asleep (set up below)
  let mode = "idle"; // idle | busy | present
  let queue = [];
  let step = null;
  let clock = 0;
  let winnerInfo = null;
  let held = null; // the bone in the dog's mouth
  let shuffleLeft = 0;
  let digLaunches = [];
  let digDir = 1;
  let nextLaunch = 0;
  let rustle = null;
  let presentT = 0;
  let nextBlink = 2;
  let lastVariant = null;
  let cursorMode = null;

  const call = (fn) => ({ start: fn, dur: 0 });
  const wait = (dur) => ({ dur });
  const waitFor = (pred) => ({ update: () => pred() });
  /** Ease any numeric dog properties to target values. */
  const blend = (target, dur) => ({
    start() {
      this.from = Object.fromEntries(Object.keys(target).map((k) => [k, dog[k]]));
    },
    update(t) {
      const k = easeInOut(Math.min(1, t / dur));
      for (const key in target) dog[key] = lerp(this.from[key], target[key], k);
      return t >= dur;
    },
  });
  const turnTo = (facing) => ({
    start() {
      this.from = dog.facing;
    },
    update(t) {
      if (Math.sign(this.from) === facing) {
        dog.facing = facing;
        return true;
      }
      const k = Math.min(1, t / 0.22);
      dog.facing = this.from * Math.cos(Math.PI * k);
      dog.turnPulse = Math.sin(Math.PI * k);
      if (k >= 1) {
        dog.facing = facing;
        dog.turnPulse = 0;
      }
      return k >= 1;
    },
  });
  /** Advance the gait; each footfall (twice per stride) gets a soft paw sound. */
  const stepPhase = (moved, loudness) => {
    const before = Math.floor(dog.phase / Math.PI);
    dog.phase += (moved / GAIT_LENGTH) * Math.PI * 2;
    if (Math.floor(dog.phase / Math.PI) !== before && moved > 0.5) sfx.paw(loudness);
  };
  const moveTo = (x, speed, { gaitCap = 1, ease = true } = {}) => ({
    start() {
      this.x0 = dog.x;
      this.dur = Math.max(0.3, Math.abs(x - dog.x) / speed + (ease ? 0.25 : 0));
    },
    update(t, dt) {
      const k = Math.min(1, t / this.dur);
      const prev = dog.x;
      dog.x = lerp(this.x0, x, ease ? easeInOut(k) : k);
      const moved = Math.abs(dog.x - prev);
      dog.speed = dt > 0 ? moved / dt : 0;
      stepPhase(moved, clamp(dog.speed / 650, 0.15, 1));
      dog.gait = Math.min(gaitCap, clamp(dog.speed / 120, 0, 1));
      dog.lean = clamp(dog.speed / 300, 0, 1);
      if (k >= 1) {
        dog.speed = 0;
        dog.gait = 0;
        dog.lean = 0;
      }
      return k >= 1;
    },
  });
  const runTo = (x, speed = RUN_SPEED) => moveTo(x, speed);
  /** Ballistic hop/jump; `x = null` hops in place. */
  const jump = (x, height, dur, { onMid, onLand } = {}) => ({
    start() {
      this.x0 = dog.x;
      this.x1 = x ?? dog.x;
      this.y0 = dog.y;
      this.mid = false;
      if (height > 60) sfx.whoosh(clamp(height / 200, 0.4, 1));
    },
    update(t) {
      const k = Math.min(1, t / dur);
      dog.x = lerp(this.x0, this.x1, k);
      dog.y = lerp(this.y0, 0, k) - height * 4 * k * (1 - k);
      dog.air = Math.sin(Math.PI * k);
      if (!this.mid && k >= 0.5) {
        this.mid = true;
        onMid?.();
      }
      if (k >= 1) {
        dog.air = 0;
        dog.y = 0;
        dog.squash = 1;
        for (let i = 0; i < 5; i++) puff(dog.x + rand(-60, 60), -6, rand(-120, 120), rand(-80, -20));
        // A custom landing (the cannonball) brings its own sound.
        if (onLand) onLand();
        else sfx.thud(height > 150);
      }
      return k >= 1;
    },
  });
  const skid = () => ({
    start() {
      sfx.skid();
      dog.squash = 0.7;
      for (let i = 0; i < 7; i++) puff(dog.x + dog.facing * rand(-10, 70), -6, dog.facing * rand(40, 180), rand(-100, -30));
    },
    dur: 0.25,
  });
  const headShake = (dur) => ({
    start() {
      sfx.earFlap();
    },
    update(t) {
      const k = Math.min(1, t / dur);
      dog.tilt = 0.24 * Math.sin(t * 30) * (1 - k);
      dog.ear = 0.1 + 0.5 * Math.sin(t * 30 + 1);
      return k >= 1;
    },
    end() {
      dog.tilt = 0;
    },
  });
  /** Walk slowly with the nose down, sniffing. */
  const sniffTo = (x, speed) => ({
    start() {
      this.x0 = dog.x;
      this.dur = Math.max(0.3, Math.abs(x - dog.x) / speed);
      this.next = 0.1;
    },
    update(t, dt) {
      const k = Math.min(1, t / this.dur);
      const prev = dog.x;
      dog.x = lerp(this.x0, x, k);
      stepPhase(Math.abs(dog.x - prev), 0.1);
      dog.gait = 0.7;
      this.next -= dt;
      if (this.next <= 0) {
        this.next = rand(0.4, 0.65);
        sfx.sniff();
        const [nx, ny] = toWorld(dog.nose);
        for (let i = 0; i < 2; i++) puff(nx, ny, dog.facing * rand(-30, 40), rand(-60, -20), rand(2.5, 4));
      }
      if (k >= 1) dog.gait = 0;
      return k >= 1;
    },
  });

  // ---- bone actions ------------------------------------------------------------
  /** All bones hop into a fresh heap. This is the "mixing". */
  const shuffle = () => {
    const order = layoutHeap(bones);
    shuffleLeft = order.length;
    order.forEach((b) => {
      b.glow.setAttribute("opacity", 0);
      setMystery(b, false);
      b.sx = 1;
      pileLayer.appendChild(b.g);
      b.mode = "tween";
      b.tween = {
        from: { x: b.x, y: b.y, r: b.r },
        t: -rand(0, 1.3),
        dur: rand(0.5, 0.7),
        arc: rand(90, 210),
        spin: Math.random() < 0.45 ? Math.PI * 2 * (Math.random() < 0.5 ? -1 : 1) : 0,
      };
    });
    held = null;
  };

  /** Top-most bones near a spot. */
  const topBonesNear = (x, range, count) =>
    bones
      .filter((b) => b.mode === "rest" && b !== held && Math.abs(b.x - x) < range)
      .sort((a, b) => a.y - b.y)
      .slice(0, count);

  const launch = (b, dir, speed = rand(640, 880)) => {
    frontLayer.appendChild(b.g);
    Object.assign(b, { mode: "fly", vx: dir * speed, vy: rand(-680, -540), vr: rand(-14, 14) });
    sfx.whoosh(0.3);
    for (let i = 0; i < 3; i++) puff(b.x + rand(-20, 20), b.y + 10, dir * rand(40, 160), rand(-120, -40));
  };

  /** Scratch at the pile; bones on top get flung out behind the dog. */
  const dig = (dur, count, { rustleAt = null } = {}) => ({
    start() {
      dog.scratch = rustleAt == null ? 1 : 0.5;
      const [mx] = toWorld(dog.mouth);
      digDir = -dog.facing;
      digLaunches = count ? topBonesNear(mx, 140, count) : [];
      nextLaunch = rand(0.15, 0.3);
      rustle = rustleAt == null ? null : { x: rustleAt, next: 0 };
    },
    update(t) {
      return t >= dur;
    },
    end() {
      dog.scratch = 0;
      if (rustle) for (const b of bones) if (b.mode === "rest") placeBone(b);
      rustle = null;
      digLaunches = [];
    },
  });

  /** A fresh bone with the winner's name hidden behind a "?". */
  const mysteryBone = () => {
    const b = makeBone(winnerInfo._id, labelMap.get(winnerInfo._id) ?? winnerInfo.firstName, { stamped: true });
    setMystery(b, true);
    b.fromPile = true;
    bones.push(b);
    return b;
  };
  /** A named bone that isn't the winner's, near the dog's mouth (for the fake-out). */
  const decoyBone = () => {
    const [mx] = toWorld(dog.mouth);
    const pick = bones
      .filter((b) => b.mode === "rest" && b.text && b.id !== winnerInfo._id)
      .sort((a, b) => Math.abs(a.x - mx) + (a.y + 300) * 0.4 - (Math.abs(b.x - mx) + (b.y + 300) * 0.4))[0];
    if (pick) return pick;
    const blank = makeBone(`blank-decoy-${Date.now()}`, null);
    blank.fromPile = true;
    bones.push(blank);
    return blank;
  };

  /** Plunge in, clamp onto a bone, pull it out with a toss of the head. */
  const grab = (pick) => ({
    start() {
      this.bone = null;
    },
    update(t) {
      if (t < 0.32) {
        const k = easeInOut(t / 0.32);
        dog.extraNeck = 0.25 * k;
        dog.extraHead = 0.35 * k;
        dog.chomp = k;
      } else {
        if (!this.bone) {
          const b = pick();
          this.bone = b;
          held = b;
          const [mx, my] = toWorld(dog.mouth);
          frontLayer.appendChild(b.g);
          b.tween = { from: b.fromPile ? { x: mx, y: my + 36, r: 0 } : { x: b.x, y: b.y, r: b.r }, t: 0 };
          b.fromPile = false;
          b.mode = "held";
          sfx.clack(0.85);
          for (let i = 0; i < 6; i++) puff(mx + rand(-30, 30), my + 10, rand(-90, 90), rand(-170, -60));
        }
        dog.chomp = Math.max(0, 1 - (t - 0.32) / 0.06); // snap shut on it
        const k = Math.min(1, (t - 0.32) / 0.45);
        dog.extraNeck = lerp(0.25, -0.1, easeInOut(k));
        dog.extraHead = lerp(0.35, -0.3, easeInOut(k));
        dog.dig = Math.min(dog.dig, 1 - easeInOut(k));
      }
      return t >= 0.85;
    },
    end() {
      dog.chomp = 0;
      dog.extraNeck = 0;
      dog.extraHead = -0.12; // proud, nose up, while it carries the bone
    },
  });

  const toss = () =>
    call(() => {
      const b = held;
      held = null;
      Object.assign(b, { mode: "fly", vx: -dog.facing * rand(360, 520), vy: -rand(700, 820), vr: rand(-18, 18) });
      sfx.whoosh(0.6);
      sfx.wahwah();
      say("toss");
    });

  /** Flip the held bone over to reveal the name. The big moment. */
  const flip = () => ({
    start() {
      this.swapped = false;
    },
    update(t) {
      const k = Math.min(1, t / 0.5);
      held.sx = Math.max(0.03, Math.abs(Math.cos(Math.PI * k)));
      if (!this.swapped && k >= 0.5) {
        this.swapped = true;
        setMystery(held, false);
      }
      return k >= 1;
    },
    end() {
      held.sx = 1;
      // The revealed bone replaces the winner's copy in the pile.
      const original = bones.find((b) => b.id === held.id && b !== held);
      if (original) {
        original.g.remove();
        bones.splice(bones.indexOf(original), 1);
      }
      mode = "present";
      presentT = 0;
      dog.wagSpeed = 13;
      dog.wagAmp = 0.35;
      callbacks.current.onLanded?.(theme);
      // The parent plays sfx.happyBarks(0.12) on landing: a bark, then a yip.
      say("bark", 0.12);
      say("yip", 0.32);
    },
  });

  // ---- routines ------------------------------------------------------------------
  const digPointRight = () => PILE_X + rand(20, PILE_HALF * 0.62);
  const digPointLeft = () => PILE_X - rand(40, PILE_HALF * 0.62);
  /** Where to stand so the mouth lands on `point` while facing `facing`. */
  const standFor = (point, facing) => point - facing * digReach;
  const approachAndDig = (point, facing = -1) => [
    turnTo(facing),
    runTo(standFor(point, facing), rand(380, 460)),
    blend({ dig: 1 }, 0.3),
  ];

  const intro = () => [
    call(() => {
      pop("!");
      voice("bark");
      dog.wagSpeed = 18;
      dog.wagAmp = 0.45;
      dog.extraHead = 0;
    }),
    blend({ sit: 0 }, 0.3),
    jump(null, 26, 0.34),
    call(shuffle),
    // Play bow while the bones settle.
    call(() => voice("yip", { delay: 0.15 })),
    blend({ dig: 0.55, extraNeck: -0.55, extraHead: -0.65, wiggle: 1 }, 0.3),
    wait(rand(0.9, 1.3)),
    blend({ dig: 0, extraNeck: 0, extraHead: 0, wiggle: 0 }, 0.25),
    waitFor(() => shuffleLeft <= 0),
    wait(0.2),
    call(() => callbacks.current.onSuspense?.(true)),
  ];

  const search = (variant) => {
    switch (variant) {
      case "around": {
        // Runs past the pile and digs from the far side; bones fly off left.
        const point = digPointLeft();
        return [
          turnTo(-1),
          runTo(standFor(point, 1), rand(440, 500)),
          wait(0.15),
          turnTo(1),
          blend({ dig: 1 }, 0.3),
          dig(rand(2.4, 3.1), randInt(4, 6)),
          grab(mysteryBone),
        ];
      }
      case "fakeout": {
        // Pulls out the wrong bone, looks at it, shakes its head, tosses it.
        const first = digPointRight();
        let second = digPointRight();
        if (Math.abs(second - first) < 60) second = first > PILE_X + 90 ? first - 90 : first + 90;
        return [
          ...approachAndDig(first),
          dig(rand(1.5, 1.9), 3),
          grab(decoyBone),
          blend({ dig: 0, extraHead: -0.35 }, 0.3),
          wait(0.45),
          call(() => pop("?")),
          wait(0.35),
          headShake(0.8),
          toss(),
          wait(0.3),
          blend({ extraHead: 0 }, 0.15),
          moveTo(standFor(second, -1), 200),
          blend({ dig: 1 }, 0.3),
          dig(rand(1.9, 2.4), 3),
          grab(mysteryBone),
        ];
      }
      case "sniffer": {
        // Nose down along the pile, freezes in a pointer pose, then pounces.
        const start = PILE_X + PILE_HALF + 100;
        const stop = start - rand(110, 170);
        return [
          turnTo(-1),
          runTo(start, 400),
          blend({ sniff: 1 }, 0.3),
          sniffTo(stop, 80),
          wait(0.25),
          sniffTo(stop - 22, 45),
          blend({ sniff: 0, pawUp: 1, tailStiff: 1, extraNeck: 0.1, extraHead: -0.08 }, 0.25),
          call(() => pop("!")),
          wait(1.1),
          blend({ pawUp: 0, tailStiff: 0, extraNeck: 0, extraHead: 0 }, 0.12),
          call(() => voice("woof", { gain: 0.6 })),
          jump(stop - 90, 80, 0.45),
          blend({ dig: 1 }, 0.2),
          dig(rand(1.1, 1.5), 3),
          grab(mysteryBone),
        ];
      }
      case "cannonball": {
        // Leaps into the middle of the pile, rummages out of sight, bursts out.
        const impact = PILE_X + rand(-50, 50);
        return [
          turnTo(-1),
          runTo(PILE_X + PILE_HALF + 170, 450),
          blend({ dig: 0.35, wiggle: 1 }, 0.25),
          wait(0.45),
          blend({ dig: 0, wiggle: 0 }, 0.1),
          call(() => voice("woof")),
          jump(impact + 40, 190, 0.85, {
            onLand: () => {
              setDogBehindPile(true);
              cam.shake = 1;
              sfx.avalanche();
              // Throw clear of the spotlight to the right, or off stage left.
              for (const b of topBonesNear(impact, 220, 10)) {
                const dir = Math.sign(b.x - impact) || 1;
                launch(b, dir, dir > 0 ? rand(760, 980) : rand(320, 620));
              }
              for (let i = 0; i < 14; i++) puff(impact + rand(-120, 120), -rand(20, 120), rand(-220, 220), rand(-260, -60), rand(6, 11));
            },
          }),
          blend({ dig: 1 }, 0.2),
          dig(rand(1.8, 2.4), 0, { rustleAt: impact }),
          grab(mysteryBone),
          turnTo(1),
          call(() => voice("yip")),
          jump(PILE_X + PILE_HALF + 90, 160, 0.8, { onMid: () => setDogBehindPile(false) }),
        ];
      }
      default: {
        // "dig" and "zoomies" both start with a plain dig.
        return [...approachAndDig(digPointRight()), dig(rand(2.4, 3.2), randInt(4, 7)), grab(mysteryBone)];
      }
    }
  };

  const outro = (variant) => {
    const reveal = [
      blend({ sit: 1, extraHead: 0 }, 0.4),
      call(() => {
        camMode = "present";
        callbacks.current.onSuspense?.("climax"); // suspense builds to its peak
      }),
      wait(1.0),
      flip(),
    ];
    if (variant === "zoomies") {
      // Victory lap with the bone before sitting down.
      return [
        turnTo(1),
        call(() => voice("yip")),
        runTo(SPOT_X + 290, 650),
        skid(),
        turnTo(-1),
        runTo(SPOT_X - 190, 650),
        skid(),
        turnTo(1),
        runTo(SPOT_X, 320),
        ...reveal,
      ];
    }
    return [turnTo(1), runTo(SPOT_X, 380), ...reveal];
  };

  const pickVariant = () => {
    if (forcedVariant) return forcedVariant;
    const options = VARIANTS.filter((v) => v !== lastVariant);
    return options[Math.floor(Math.random() * options.length)];
  };

  const draw = (winner) => {
    if (pending) {
      rebuildBones(pending);
      pending = null;
    }
    winnerInfo = winner;
    petHop = null;
    dog.y = 0;
    const variant = pickVariant();
    lastVariant = variant;
    mode = "busy";
    camMode = "home";
    presentT = 0;
    dog.tilt = 0;
    setDogBehindPile(false);
    queue = [...intro(), ...search(variant), ...outro(variant)];
    step = null;
    wake();
  };

  // ---- petting (between draws) ------------------------------------------------------
  let petHop = null;
  let lastPet = 0;
  let petStreak = 0;
  const petDog = () => {
    if (mode === "busy") return;
    const now = performance.now();
    if (now - lastPet < 380) return;
    petStreak = now - lastPet < 1600 ? petStreak + 1 : 1;
    lastPet = now;
    if (petStreak >= 5) {
      // Five quick pets: a happy howl and a flurry of hearts.
      petStreak = 0;
      voice("howl");
      for (let i = 0; i < 4; i++) setTimeout(heart, i * 130);
    } else {
      voice(Math.random() < 0.5 ? "bark" : "yip");
      heart();
    }
    dog.wagSpeed = 22;
    dog.wagAmp = 0.55;
    petHop = { t: 0 };
  };
  const pokeBone = (b) => {
    if (b === held) return petDog();
    if (mode === "busy" || b.mode !== "rest") return;
    b.mode = "hop";
    b.hop = { t: 0, y: b.y, r: b.r, spin: rand(-0.35, 0.35) };
    sfx.clack(0.5);
  };
  dogRoot.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    petDog();
  });
  const onBonePointer = (e) => {
    const g = e.target.closest?.("[data-bone]");
    const b = g && boneByNode.get(g);
    if (!b) return;
    e.preventDefault();
    pokeBone(b);
  };
  pileLayer.addEventListener("pointerdown", onBonePointer);
  frontLayer.addEventListener("pointerdown", onBonePointer);

  const reset = () => {
    queue = [];
    step = null;
    mode = "idle";
    camMode = "home";
    held = null;
    setDogBehindPile(false);
    Object.assign(dog, {
      x: SPOT_X,
      y: 0,
      facing: 1,
      sit: 1,
      dig: 0,
      gait: 0,
      scratch: 0,
      extraNeck: 0,
      extraHead: 0,
      tilt: 0,
      sniff: 0,
      pawUp: 0,
      tailStiff: 0,
      wiggle: 0,
      air: 0,
      chomp: 0,
    });
    talks = [];
    rebuildBones(pending ?? latest);
    pending = null;
    wake();
  };

  let latest = [];
  const setParticipants = (list) => {
    latest = list;
    // Mid-draw or while the winner is on show, apply it at the next draw.
    if (mode === "idle") rebuildBones(list);
    else pending = list;
  };

  // How far ahead of the dog its mouth reaches while digging, so the dog can
  // park with its mouth over a chosen spot.
  Object.assign(dog, { sit: 0, dig: 1, extraNeck: 0.12, extraHead: 0.18 });
  solveDog(0);
  const digReach = dog.mouth[0];
  Object.assign(dog, { sit: 1, dig: 0, extraNeck: 0, extraHead: 0 });

  // ---- per-frame update --------------------------------------------------------
  const updateBones = (dt) => {
    for (const b of bones) {
      if (b.mode === "tween") {
        const tw = b.tween;
        tw.t += dt;
        if (tw.t < 0) continue;
        const k = Math.min(1, tw.t / tw.dur);
        b.x = lerp(tw.from.x, b.slot.x, k);
        b.y = lerp(tw.from.y, b.slot.y, k) - tw.arc * 4 * k * (1 - k);
        b.r = lerp(tw.from.r + tw.spin, b.slot.r, easeInOut(k));
        if (k >= 1) {
          b.mode = "rest";
          shuffleLeft -= 1;
          clack(0.35);
        }
        placeBone(b);
      } else if (b.mode === "fly") {
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        const rest = -BONE_REST;
        if (b.y > rest) {
          b.y = rest;
          if (b.vy > 140) clack(Math.min(0.75, b.vy / 1300));
          b.vy = -b.vy * 0.3;
          b.vx *= 0.55;
          b.vr *= 0.4;
          if (Math.abs(b.vy) < 70) b.mode = "settle";
        }
        placeBone(b);
      } else if (b.mode === "settle") {
        const upright = Math.round(b.r / (Math.PI * 2)) * Math.PI * 2;
        const k = 1 - Math.exp(-dt * 9);
        b.r = lerp(b.r, upright, k);
        b.x += b.vx * dt;
        b.vx *= 1 - k;
        if (Math.abs(b.r - upright) < 0.01 && Math.abs(b.vx) < 2) {
          b.r = upright;
          b.mode = "rest";
        }
        placeBone(b);
      } else if (b.mode === "held") {
        const [mx, my] = toWorld(dog.mouth);
        const wobble = 0.06 * Math.sin(dog.phase * 2) * dog.gait + 0.03 * Math.sin(clock * 3) * (mode === "present" ? 1 : 0);
        const tw = b.tween;
        if (tw && tw.t < 0.16) {
          tw.t += dt;
          const k = easeInOut(Math.min(1, tw.t / 0.16));
          b.x = lerp(tw.from.x, mx, k);
          b.y = lerp(tw.from.y, my, k);
          b.r = lerp(tw.from.r, wobble, k);
        } else {
          b.x = mx;
          b.y = my;
          b.r = wobble;
        }
        placeBone(b);
      } else if (b.mode === "hop") {
        const h = b.hop;
        h.t += dt;
        const k = Math.min(1, h.t / 0.34);
        b.y = h.y - 30 * 4 * k * (1 - k);
        b.r = h.r + h.spin * Math.sin(Math.PI * k);
        if (k >= 1) {
          b.y = h.y;
          b.r = h.r;
          b.mode = "rest";
          clack(0.3);
        }
        placeBone(b);
      } else if (rustle && Math.abs(b.x - rustle.x) < 180) {
        placeBone(b, rand(-3, 3), rand(-3, 3));
      }
    }
  };

  const updateFx = (dt) => {
    for (const p of puffs) {
      if (p.life <= 0) continue;
      p.life -= dt * 1.6;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      const r = p.size * (1 + (1 - p.life) * 1.6);
      p.node.setAttribute("cx", p.x.toFixed(1));
      p.node.setAttribute("cy", p.y.toFixed(1));
      p.node.setAttribute("r", r.toFixed(1));
      p.node.setAttribute("opacity", Math.max(0, p.life * 0.32).toFixed(2));
    }
    for (const s of sparkles) {
      if (s.life <= 0) continue;
      s.life -= dt * 1.4;
      const scale = s.size * Math.sin(Math.PI * clamp(1 - s.life, 0, 1));
      s.node.setAttribute("transform", tf(s.x, s.y, s.spin * (1 - s.life), scale, scale));
      s.node.setAttribute("opacity", Math.max(0, s.life).toFixed(2));
    }
    for (const h of hearts) {
      if (h.life <= 0) continue;
      h.life -= dt * 0.9;
      h.y -= 70 * dt;
      h.x += h.drift * dt;
      const sc = 1.7 * (1 + (1 - h.life) * 0.4);
      h.node.setAttribute("transform", tf(h.x, h.y, 0, sc, sc));
      h.node.setAttribute("opacity", Math.max(0, Math.min(1, h.life * 1.6)).toFixed(2));
    }
    if (bangT >= 0) {
      bangT += dt;
      const [hx, hy] = toWorld(dog.headTop);
      const p = bangT < 0.3 ? easeOutBack(bangT / 0.3) : 1;
      const fade = bangT < 0.8 ? 1 : Math.max(0, 1 - (bangT - 0.8) / 0.3);
      bang.setAttribute("transform", tf(hx, hy - 10 * p, 0.12, p, p));
      bang.setAttribute("opacity", fade.toFixed(2));
      if (bangT > 1.1) bangT = -1;
    }
  };

  const update = (dt) => {
    clock += dt;

    // Timeline.
    let budget = dt;
    for (let guard = 0; guard < 20; guard++) {
      if (!step) {
        step = queue.shift();
        if (!step) break;
        step.t = 0;
        step.start?.call(step);
      }
      step.t += budget;
      const done = step.update ? step.update.call(step, step.t, budget) : step.t >= (step.dur ?? 0);
      if (!done) break;
      step.end?.call(step);
      step = null;
      budget = 0;
    }

    // Digging: paws scratch, dust flies, bones on top get flung out.
    if (dog.scratch > 0) {
      const before = Math.floor(dog.scratchPhase / Math.PI);
      dog.scratchPhase += dt * 15;
      if (Math.floor(dog.scratchPhase / Math.PI) !== before) {
        sfx.scratch();
        const [px, py] = toWorld([digReach + 12, -10]);
        puff(px, py - rand(0, 20), -dog.facing * rand(20, 120), rand(-170, -80));
      }
      nextLaunch -= dt;
      if (nextLaunch <= 0 && digLaunches.length) {
        launch(digLaunches.shift(), digDir);
        nextLaunch = rand(0.25, 0.45);
      }
    }
    if (rustle) {
      rustle.next -= dt;
      if (rustle.next <= 0) {
        rustle.next = rand(0.12, 0.3);
        clack(0.25);
        puff(rustle.x + rand(-140, 140), -rand(40, 150), rand(-80, 80), rand(-140, -40), rand(4, 8));
      }
    }

    // Life: blinks, ears, squash, head tilt while showing off the bone.
    nextBlink -= dt;
    if (nextBlink <= 0) {
      dog.blink = Math.min(1, dog.blink + dt * 14);
      if (dog.blink >= 1) nextBlink = rand(2.5, 5);
    } else dog.blink = Math.max(0, dog.blink - dt * 10);
    dog.squash = Math.max(0, dog.squash - dt * 5);
    // Mouth: open with each bark, parted around a carried bone, wide to grab.
    let talk = 0;
    let look = 0;
    talks = talks.filter((v) => {
      v.t += dt;
      if (v.t < 0) return true;
      const k = v.t < 0.05 ? v.t / 0.05 : Math.min(1, 1 - (v.t - 0.05 - v.hold) / 0.16);
      if (k <= 0) return false;
      talk = Math.max(talk, v.open * k);
      look = Math.max(look, (v.lookUp ?? 0) * k);
      return true;
    });
    const jawTarget = Math.max(held ? JAW_HOLD + 0.35 * talk : talk, dog.chomp);
    dog.jaw = lerp(dog.jaw, jawTarget, 1 - Math.exp(-dt * 35));
    dog.lookUp = lerp(dog.lookUp, look, 1 - Math.exp(-dt * 7));
    const earTarget =
      dog.dig > 0.5 || dog.sniff > 0.5
        ? 0.55
        : 0.12 + 0.35 * Math.sin(dog.phase * 2) * dog.gait + 0.05 * Math.sin(clock * 1.7) - 0.3 * dog.tailStiff;
    dog.ear = lerp(dog.ear, earTarget, 1 - Math.exp(-dt * 10));
    if (mode === "idle") {
      dog.wagSpeed = lerp(dog.wagSpeed, 3, dt);
      dog.wagAmp = lerp(dog.wagAmp, 0.15, dt);
    } else if (mode === "present") {
      dog.wagSpeed = lerp(dog.wagSpeed, 13, dt);
      dog.wagAmp = lerp(dog.wagAmp, 0.35, dt);
    }
    if (petHop) {
      petHop.t += dt;
      const k = Math.min(1, petHop.t / 0.3);
      dog.y = -14 * 4 * k * (1 - k);
      if (k >= 1) {
        dog.y = 0;
        dog.squash = 0.6;
        petHop = null;
      }
    }
    if (mode !== cursorMode) {
      svg.classList.toggle("df-busy", mode === "busy");
      cursorMode = mode;
    }
    if (mode === "present" && held) {
      presentT += dt;
      dog.tilt = 0.14 * easeInOut(Math.min(1, presentT / 0.6)) + 0.03 * Math.sin(clock * 1.3);
      held.glow.setAttribute("opacity", (0.45 * Math.min(1, presentT / 0.5) + 0.1 * Math.sin(clock * 3)).toFixed(2));
      if (presentT < 2.2 && Math.random() < dt * 9) sparkle(held.x + rand(-80, 80), held.y + rand(-50, 30));
    }

    updateBones(dt);
    solveDog(clock);
    updateFx(dt);
    themeFx.update(dt, clock);
    updateCamera(dt);
  };

  // ---- sizing / loop / teardown -----------------------------------------------
  const fit = () => {
    vw = host.clientWidth || 1;
    vh = host.clientHeight || 1;
    for (const s of [skySvg, svg, nearSvg]) s.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    cam.ready = false;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  // Sleep while nobody can see the stage (scrolled away, or behind the winner
  // dialog) — but never mid-draw, so the reveal never waits.
  let raf = 0;
  let last = 0;
  let onScreen = true;
  let covered = false;
  let slowFrames = 0;
  const asleep = () => mode !== "busy" && (!onScreen || covered);
  const frame = (ts) => {
    if (asleep()) {
      raf = 0;
      last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
    // A rich scene that keeps missing frames (< ~35 fps for a second or two)
    // falls back to the lean look.
    if (quality === "rich" && last) {
      slowFrames = ts - last > 28 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 45) goLean();
    }
    const dt = last ? Math.min(1 / 30, (ts - last) / 1000) : 1 / 60;
    last = ts;
    update(dt);
  };
  wake = () => {
    if (!raf && !asleep()) raf = requestAnimationFrame(frame);
  };
  const io = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    wake();
  });
  io.observe(host);
  wake();

  const setCovered = (value) => {
    covered = value;
    wake();
  };

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    for (const s of [skySvg, svg, nearSvg]) s.remove();
  };

  return { draw, reset, setParticipants, setCovered, dispose, theme, quality: () => quality };
}

// ---------------------------------------------------------------------------
// Seasonal scene effects (hats and neckwear live in lib/themes)
// ---------------------------------------------------------------------------

/**
 * Ambient particles (snow, petals, leaves...) drifting across the stage; about
 * a third go in front of the dog for depth. Returns the per-frame update.
 */
function drifters({ sky, near }, { count, draw, vy, sway = 12, spin = 0, scale = [0.7, 1.2], front = 0.33, rising = false }) {
  const top = -440;
  const bottom = 40;
  const items = Array.from({ length: count }, (_, i) => {
    const g = el("g", {}, Math.random() < front ? near : sky);
    draw(g, i);
    return {
      g,
      x: rand(-850, 750),
      y: rand(top, bottom),
      vy: rand(vy[0], vy[1]),
      phase: rand(0, 6.28),
      r: rand(0, 6.28),
      spin: rand(-spin, spin),
      s: rand(scale[0], scale[1]),
    };
  });
  return (dt, clock) => {
    for (const p of items) {
      p.y += (rising ? -1 : 1) * p.vy * dt;
      p.x += Math.sin(clock * 0.9 + p.phase) * sway * dt;
      p.r += p.spin * dt;
      if (!rising && p.y > bottom) {
        p.y = top;
        p.x = rand(-850, 750);
      } else if (rising && p.y < top) {
        p.y = bottom;
        p.x = rand(-850, 750);
      }
      p.g.setAttribute("transform", tf(p.x, p.y, p.r, p.s, p.s));
    }
  };
}

/** Fireworks bursting in the sky behind the stage. */
function fireworks({ sky }, colors) {
  const sparks = Array.from({ length: 96 }, () => ({ node: el("circle", { r: 2.4, opacity: 0 }, sky), life: 0 }));
  let next = 0.4;
  return (dt) => {
    next -= dt;
    if (next <= 0) {
      next = rand(0.6, 1.3);
      const cx = rand(-620, 520);
      const cy = rand(-400, -230);
      const color = colors[randInt(0, colors.length - 1)];
      for (let i = 0; i < 16; i++) {
        const s = sparks.find((q) => q.life <= 0);
        if (!s) break;
        const a = (i / 16) * Math.PI * 2 + rand(-0.1, 0.1);
        const v = rand(80, 140);
        Object.assign(s, { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 });
        s.node.setAttribute("fill", color);
      }
    }
    for (const s of sparks) {
      if (s.life <= 0) continue;
      s.life -= dt * 0.9;
      s.vy += 50 * dt;
      s.vx *= 1 - dt * 0.8;
      s.vy *= 1 - dt * 0.8;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.node.setAttribute("cx", s.x.toFixed(1));
      s.node.setAttribute("cy", s.y.toFixed(1));
      s.node.setAttribute("opacity", Math.max(0, s.life).toFixed(2));
    }
  };
}

/** Add SVG markup to a layer and return the element it created. */
const addMarkup = (layer, markup) => {
  const g = el("g", {}, layer);
  g.innerHTML = markup;
  return g;
};

/**
 * Per theme: builds the scene's animated extras (particles, props) and returns
 * their per-frame update. Dates live in lib/themes CALENDAR.
 */
const SCENES = {
  newyear(ctx) {
    const fw = fireworks(ctx, [MINT, "#f7c948", "#ffffff", "#ff8fb3", "#a78bfa"]);
    const glitter = drifters(ctx, {
      count: 36,
      vy: [15, 35],
      sway: 10,
      spin: 3,
      scale: [0.6, 1.1],
      draw: (g, i) => el("rect", { x: -2.5, y: -1.5, width: 5, height: 3, fill: ["#f7c948", MINT, "#ffffff"][i % 3], opacity: 0.8 }, g),
    });
    return (dt, clock) => {
      fw(dt);
      glitter(dt, clock);
    };
  },

  valentines(ctx) {
    return drifters(ctx, {
      count: 18,
      rising: true,
      vy: [18, 38],
      sway: 16,
      spin: 0.4,
      scale: [0.6, 1.3],
      front: 0.25,
      draw: (g, i) => el("path", { d: HEART, fill: i % 2 ? "#ff5d8f" : "#ff9fc0", opacity: 0.55 }, g),
    });
  },

  stpatricks(ctx) {
    return drifters(ctx, {
      count: 22,
      vy: [16, 34],
      sway: 14,
      spin: 1.2,
      scale: [0.6, 1.1],
      draw: (g) => {
        g.innerHTML = cloverSvg();
        g.setAttribute("opacity", 0.8);
      },
    });
  },

  spring(ctx) {
    return drifters(ctx, {
      count: 34,
      vy: [18, 36],
      sway: 26,
      spin: 2.2,
      scale: [0.7, 1.3],
      draw: (g, i) => el("ellipse", { cx: 0, cy: 0, rx: 5, ry: 3, fill: i % 3 ? "#ffc4dc" : "#fff0f6", opacity: 0.8 }, g),
    });
  },

  summer(ctx) {
    // Sun rays turning slowly around the moon (above the ground only).
    const [cx, cy] = ctx.moonCenter;
    const rays = el("g", { opacity: 0.32 }, ctx.sky);
    const rayGroup = el("g", {}, rays);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const pt = (r, da) => `${(cx + Math.cos(a + da) * r).toFixed(1)} ${(cy + Math.sin(a + da) * r).toFixed(1)}`;
      el("path", { d: `M ${pt(228, -0.05)} L ${pt(278, 0)} L ${pt(228, 0.05)} Z`, fill: "#ffd35c" }, rayGroup);
    }
    const clip = el("clipPath", { id: "dfSky" }, ctx.sky);
    el("rect", { x: -2000, y: -2000, width: 4000, height: 2000 }, clip);
    rays.setAttribute("clip-path", "url(#dfSky)");

    // Beach ball bouncing by the spotlight.
    const bx = SPOT_X + 255;
    const shadow = el("ellipse", { cx: 0, cy: 3, rx: 26, ry: 6, fill: "url(#dfShadow)" }, ctx.propsLayer);
    const ball = addMarkup(ctx.propsLayer, beachBallSvg());
    const spinner = ball.querySelector('[data-part="spin"]');
    return (dt, clock) => {
      rayGroup.setAttribute("transform", `rotate(${((clock * 4) % 360).toFixed(2)} ${cx} ${cy})`);
      const h = Math.abs(Math.sin(clock * 2.4)) * 30;
      ball.setAttribute("transform", `translate(${bx} ${(-24 - h).toFixed(1)})`);
      spinner.setAttribute("transform", `rotate(${((clock * 60) % 360).toFixed(1)})`);
      shadow.setAttribute("transform", `translate(${bx} 0) scale(${(1 - h / 60).toFixed(2)} 1)`);
    };
  },

  halloween(ctx) {
    // Jack-o'-lanterns either side of the stage, and bats across the moon.
    const pumpkins = addMarkup(ctx.propsLayer, pumpkinSvg(PILE_X - PILE_HALF - 35, 1.05) + pumpkinSvg(SPOT_X + 245, 0.85));
    const faces = [...pumpkins.querySelectorAll('[data-part="face"]')];
    const bats = [0, 1, 2].map((i) => {
      const g = addMarkup(ctx.sky, batSvg());
      return { g, wings: g.querySelector('[data-part="wings"]'), offset: i * 3.1, speed: 70 + i * 22, y: -250 + i * 38, scale: 0.7 + i * 0.18 };
    });
    return (dt, clock) => {
      faces.forEach((f, i) => f.setAttribute("opacity", (0.78 + 0.22 * Math.sin(clock * 9 + i * 2) * Math.sin(clock * 3.7 + i)).toFixed(2)));
      for (const b of bats) {
        const x = ((clock * b.speed + b.offset * 400) % 1300) - 750;
        const y = b.y + 22 * Math.sin(clock * 1.6 + b.offset);
        b.g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${b.scale})`);
        b.wings.setAttribute("transform", `scale(1 ${Math.cos(clock * 16 + b.offset).toFixed(2)})`);
      }
    };
  },

  autumn(ctx) {
    return drifters(ctx, {
      count: 28,
      vy: [24, 46],
      sway: 30,
      spin: 2.6,
      scale: [0.8, 1.4],
      draw: (g, i) => {
        el("path", { d: LEAF, fill: ["#d9531e", "#e8a33d", "#b8421d", "#f0c05a"][i % 4], opacity: 0.85 }, g);
        el("line", { x1: 0, y1: -8, x2: 0, y2: 12, stroke: "#7a3413", "stroke-width": 1.2, opacity: 0.8 }, g);
      },
    });
  },

  holiday(ctx) {
    return drifters(ctx, {
      count: 70,
      vy: [22, 58],
      sway: 14,
      scale: [0.5, 1.2],
      draw: (g) => el("circle", { r: rand(1.6, 3.2), fill: "#fff", opacity: rand(0.35, 0.85) }, g),
    });
  },
};
