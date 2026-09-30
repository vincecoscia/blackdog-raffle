import { useEffect, useRef } from "react";

/**
 * The draw, as a 2D cartoon: a black dog sits in the spotlight next to a pile
 * of bones — one per teammate, their name printed on it. `draw(winner)`
 * shuffles the pile, sends the dog over to dig (flinging bones behind it),
 * and has it pull out the winner's bone, trot back and sit to show it off.
 *
 * Everything is SVG, built and animated imperatively in one
 * requestAnimationFrame loop — React only provides the host element. The
 * engine hands { draw, reset } to the parent via `onReady` (this is loaded
 * through next/dynamic, which doesn't forward refs).
 */
export default function DogFetch({ participants, onReady, onLanded, onClack, onScratch }) {
  const host = useRef(null);
  const engine = useRef(null);
  const callbacks = useRef({ onReady, onLanded, onClack, onScratch });

  useEffect(() => {
    callbacks.current = { onReady, onLanded, onClack, onScratch };
  }, [onReady, onLanded, onClack, onScratch]);

  useEffect(() => {
    const e = createEngine(host.current, callbacks);
    engine.current = e;
    callbacks.current.onReady?.({ draw: e.draw, reset: e.reset });
    return () => {
      e.dispose();
      engine.current = null;
      callbacks.current.onReady?.(null);
    };
  }, []);

  useEffect(() => {
    engine.current?.setParticipants(participants);
  }, [participants]);

  return <div ref={host} className="absolute inset-0" aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
const MINT = "#77ddaf";
const INK = "#0a0a0d"; // the dog
const INK_FAR = "#202027"; // far-side legs, a touch lighter for depth
const EAR = "#1c1c23";
const EDGE = "#32323c"; // hairline that separates near-side legs from the body
const BONE = "#f2e8d5";
const BONE_SHADE = "#d6c5a4";
const BONE_LINE = "#1d1914";
const BONE_INK = "#2a2320";
const FONT = "font-family: var(--font-bricolage), var(--font-inter), ui-sans-serif, sans-serif; font-weight: 800";

// ---------------------------------------------------------------------------
// Stage layout (SVG units; the ground is y = 0 and up is negative y)
// ---------------------------------------------------------------------------
const PILE_X = -330;
const PILE_HALF = 230;
const WINNER_X = PILE_X + 120; // the winner is buried on the pile's right flank
const SPOT_X = 150; // where the dog sits, in the spotlight
const RUN_SPEED = 380;
const GRAVITY = 1500;
const MIN_BONES = 22; // pad small rosters with blank bones so the pile looks full
const BONE_REST = 26; // bone centre height when lying on the ground
const CAM_HOME = { x: PILE_X - PILE_HALF - 75, y: -300, w: SPOT_X + 330 - (PILE_X - PILE_HALF - 75), h: 340 };

// ---------------------------------------------------------------------------
// Dog rig (dog-local units, facing +x; hips frame origin at the hip pivot)
// ---------------------------------------------------------------------------
const HIP_X = -50;
const SHOULDER = [92, -22];
const FRONT_ATTACH = [100, 18];
const REAR_ATTACH = [6, 14];
const FRONT_LEG = { L1: 48, L2: 44, W1: 22, W2: 15 };
const REAR_LEG = { L1: 48, L2: 46, W1: 30, W2: 16 };
const NECK_LEN = 56;
const MOUTH = [46, 35]; // held-bone centre: clamped just under the muzzle
const PAW_Y = -8;
const STRIDE = 22;
const LIFT = 16;
const GAIT_LENGTH = 80; // ground covered per full stride cycle
const TAIL_SEGMENTS = [14, 12, 10, 8, 6];
const TAIL_SEG_LEN = 17;

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

// Classic dog-bone outline: a shaft with two overlapping knobs at each end.
const BONE_PATH =
  "M -33 -11 L 33 -11 A 15 15 0 1 1 58.2 0 A 15 15 0 1 1 33 11 L -33 11 A 15 15 0 1 1 -58.2 0 A 15 15 0 1 1 -33 -11 Z";
const STAR_PATH = "M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z";

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
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (a, b) => a + Math.random() * (b - a);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const tf = (x, y, r = 0, sx = 1, sy = 1) =>
  `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg(r).toFixed(2)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`;

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
  // ---- svg + stage -----------------------------------------------------------
  const svg = el("svg", { width: "100%", height: "100%", style: "position:absolute;inset:0;display:block" }, host);
  const defs = el("defs", {}, svg);
  const radial = (id, stops, attrs = {}) => {
    const g = el("radialGradient", { id, ...attrs }, defs);
    for (const [o, c, a] of stops) el("stop", { offset: o, "stop-color": c, "stop-opacity": a }, g);
  };
  radial("dfBg", [
    ["0", "#10211b", 1],
    ["1", "#070709", 1],
  ], { cx: "55%", cy: "42%", r: "75%" });
  radial("dfMoon", [
    ["0", "#d8f5e8", 0.26],
    ["0.72", "#bfeedb", 0.16],
    ["1", "#9fe9cb", 0.1],
  ]);
  radial("dfShadow", [
    ["0", "#000", 0.6],
    ["1", "#000", 0],
  ]);
  const floorGrad = el("linearGradient", { id: "dfFloor", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el("stop", { offset: 0, "stop-color": MINT, "stop-opacity": 0.09 }, floorGrad);
  el("stop", { offset: 1, "stop-color": MINT, "stop-opacity": 0 }, floorGrad);
  const dots = el("pattern", { id: "dfDots", width: 26, height: 26, patternUnits: "userSpaceOnUse" }, defs);
  el("circle", { cx: 1, cy: 1, r: 1.1, fill: "#fff", "fill-opacity": 0.06 }, dots);

  el("rect", { width: "100%", height: "100%", fill: "url(#dfBg)" }, svg);
  const world = el("g", {}, svg);
  const back = el("g", {}, world);
  el("rect", { x: -2000, y: -1200, width: 4000, height: 1200, fill: "url(#dfDots)" }, back);
  el("circle", { cx: SPOT_X + 40, cy: -135, r: 215, fill: "url(#dfMoon)" }, back);
  el("circle", {
    cx: SPOT_X + 40,
    cy: -135,
    r: 215,
    fill: "none",
    stroke: MINT,
    "stroke-opacity": 0.28,
    "stroke-width": 1.5,
    "vector-effect": "non-scaling-stroke",
  }, back);
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

  const pileLayer = el("g", {}, world);
  const dogLayer = el("g", {}, world);
  const frontLayer = el("g", {}, world);
  const fxLayer = el("g", {}, world);

  // ---- the dog ---------------------------------------------------------------
  const dogRoot = el("g", {}, dogLayer);
  const speedLines = [0, 1, 2].map(() =>
    el("line", { stroke: MINT, "stroke-width": 2, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke", opacity: 0 }, dogLayer)
  );
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
  el("ellipse", { cx: 98, cy: 4, rx: 42, ry: 44, fill: INK }, hips);
  el("path", { d: "M -4 -33 C 30 -40 64 -44 96 -40 L 100 44 C 76 32 40 26 -4 38 Z", fill: INK }, hips);

  const neck = el("g", {}, hips);
  el("line", { x1: 0, y1: 0, x2: 0, y2: -NECK_LEN + 6, stroke: INK, "stroke-width": 40, "stroke-linecap": "round" }, neck);
  el("rect", { x: -25, y: -16, width: 50, height: 12, rx: 6, fill: MINT }, neck);
  el("circle", { cx: 6, cy: -2, r: 7, fill: "#c9f4e3", stroke: "#2f7f63", "stroke-width": 1.5 }, neck);
  const head = el("g", {}, neck);
  el("circle", { cx: 0, cy: 0, r: 30, fill: INK }, head);
  el("path", { d: "M 4 -18 C 40 -20 68 -12 80 0 C 84 10 72 20 48 20 L 2 22 Z", fill: INK }, head);
  el("ellipse", { cx: 80, cy: 0, rx: 10, ry: 8, fill: "#000" }, head);
  el("ellipse", { cx: 77, cy: -3, rx: 3.5, ry: 2, fill: "#4a4a55" }, head);
  el("path", { d: "M 34 16 Q 50 19 64 14", fill: "none", stroke: "#2a2a31", "stroke-width": 2.5, "stroke-linecap": "round" }, head);
  const eye = el("g", {}, head);
  el("ellipse", { cx: 0, cy: 0, rx: 6.5, ry: 7, fill: "#f4fff9" }, eye);
  el("circle", { cx: 2, cy: 0.5, r: 4, fill: "#070709" }, eye);
  el("circle", { cx: 3.5, cy: -2, r: 1.4, fill: "#fff" }, eye);
  const ear = el("g", {}, head);
  el("path", { d: "M -4 0 C -22 2 -30 34 -18 54 C -10 60 2 40 8 8 Z", fill: EAR }, ear);

  const nearRear = buildLeg(REAR_ATTACH, REAR_LEG, INK, true);

  // A two-joint leg can't fold the way a sitting dog's hind leg does, so the
  // sitting pose swaps in dedicated artwork (as in the logo): a rounded haunch
  // with the hind foot lying forward on the ground. Kept upright in world
  // space and cross-faded with the jointed hind legs as the dog sits.
  const haunch = el("g", { opacity: 0 }, hips);
  el("ellipse", { cx: 16, cy: 4, rx: 42, ry: 34, transform: "rotate(-16 16 4)", fill: INK, stroke: EDGE, "stroke-width": 2.5 }, haunch);
  const hindFoot = el("g", {}, haunch);
  el("line", { x1: -6, y1: 0, x2: 46, y2: 0, stroke: EDGE, "stroke-width": 21, "stroke-linecap": "round" }, hindFoot);
  el("line", { x1: -6, y1: 0, x2: 46, y2: 0, stroke: INK, "stroke-width": 16, "stroke-linecap": "round" }, hindFoot);
  el("ellipse", { cx: 50, cy: 1, rx: 14, ry: 8.5, fill: INK, stroke: EDGE, "stroke-width": 2.5 }, hindFoot);
  // Re-cover the top of the foot with the thigh so it tucks under the haunch.
  el("ellipse", { cx: 16, cy: 4, rx: 40, ry: 32, transform: "rotate(-16 16 4)", fill: INK }, haunch);

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
    sx: 1,
    sy: 1,
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
    wagSpeed: 3,
    wagAmp: 0.15,
    ear: 0.1,
    blink: 0,
    mouth: [0, 0],
    headTop: [0, 0],
  };

  const solveDog = (clock) => {
    const P = {};
    for (const k of POSE_KEYS) P[k] = lerp(lerp(POSES.stand[k], POSES.sit[k], dog.sit), POSES.dig[k], dog.dig);
    const breathe = Math.sin(clock * 2.2) * 1.5 * (1 - dog.gait);
    const hipH = P.hipH + Math.sin(dog.phase * 2) * 4 * dog.gait - 4 * dog.lean + breathe;
    const p = P.p + 0.06 * dog.lean;
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
      const { upper, lower } = ik(A, [tx, ty], leg.dims.L1, leg.dims.L2, !front);
      leg.top.setAttribute("transform", tf(leg.attach[0], leg.attach[1], upper - p));
      leg.knee.setAttribute("transform", tf(0, leg.dims.L1, lower - upper));
      leg.paw.setAttribute("transform", tf(0, leg.dims.L2, -lower));
    }

    const neckW = P.n + dog.extraNeck;
    const headW = P.h + dog.extraHead + dog.tilt;
    neck.setAttribute("transform", tf(SHOULDER[0], SHOULDER[1], neckW - p));
    head.setAttribute("transform", tf(0, -NECK_LEN, headW - neckW));
    const S = toRoot(SHOULDER);
    const hp = [S[0] + NECK_LEN * Math.sin(neckW), S[1] - NECK_LEN * Math.cos(neckW)];
    const m = rot(MOUTH[0], MOUTH[1], headW);
    dog.mouth = [hp[0] + m[0], hp[1] + m[1]];
    dog.headTop = [hp[0] + 10, hp[1] - 70];

    eye.setAttribute("transform", `translate(16 -9) scale(1 ${(1 - dog.blink * 0.88).toFixed(3)})`);
    ear.setAttribute("transform", tf(-6, -20, dog.ear));
    tailRoot.setAttribute("transform", tf(-30, -14, P.tail));
    tail.forEach((seg, i) => {
      const wag = dog.wagAmp * Math.sin(clock * dog.wagSpeed - i * 0.8) * 0.5;
      seg.setAttribute("transform", `rotate(${deg(P.curl + wag).toFixed(2)})`);
    });
    dogRoot.setAttribute(
      "transform",
      `translate(${dog.x.toFixed(2)} ${dog.y.toFixed(2)}) scale(${(dog.facing * dog.sx).toFixed(3)} ${dog.sy.toFixed(3)})`
    );

    dogShadow.setAttribute("cx", (dog.x - dog.facing * 12).toFixed(1));
    dogShadow.setAttribute("rx", (96 - 26 * dog.sit).toFixed(1));
    dogShadow.setAttribute("opacity", clamp(1 + dog.y / 60, 0.3, 1).toFixed(2));

    // Speed lines trail the dog while it runs.
    const s = clamp((dog.speed - 150) / 250, 0, 1);
    speedLines.forEach((line, i) => {
      const y = -58 - i * 26;
      const x0 = dog.x - dog.facing * (95 + i * 14);
      line.setAttribute("x1", x0.toFixed(1));
      line.setAttribute("x2", (x0 - dog.facing * (40 + i * 10)).toFixed(1));
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      line.setAttribute("opacity", (s * (0.55 - i * 0.12)).toFixed(2));
    });
  };

  /** Dog-local point → world. */
  const toWorld = ([lx, ly]) => [dog.x + dog.facing * dog.sx * lx, dog.y + dog.sy * ly];

  // ---- bones -----------------------------------------------------------------
  let bones = [];
  let pending = null;

  const labelsFor = (list) => {
    const counts = {};
    for (const p of list) counts[p.firstName] = (counts[p.firstName] ?? 0) + 1;
    return new Map(
      list.map((p) => [p._id, counts[p.firstName] > 1 && p.lastName ? `${p.firstName} ${p.lastName[0]}.` : p.firstName])
    );
  };

  const fitLabel = (text) => {
    try {
      const len = text.getComputedTextLength();
      if (len > 92) text.style.fontSize = `${(17 * 92) / len}px`;
    } catch {
      /* not rendered yet */
    }
  };

  const makeBone = (id, label) => {
    const g = el("g", {}, pileLayer);
    const glow = el("path", { d: BONE_PATH, fill: "none", stroke: MINT, "stroke-width": 12, "stroke-linejoin": "round", opacity: 0 }, g);
    el("path", { d: BONE_PATH, fill: BONE_SHADE, transform: "translate(0 4)" }, g);
    el("path", { d: BONE_PATH, fill: BONE, stroke: BONE_LINE, "stroke-width": 2, "stroke-linejoin": "round" }, g);
    el("path", { d: "M -30 -5.5 L 18 -5.5", stroke: "#fffaf0", "stroke-width": 3, "stroke-linecap": "round", opacity: 0.7 }, g);
    let underline = null;
    if (label) {
      const text = el("text", {
        x: 0,
        y: 1.5,
        "text-anchor": "middle",
        "dominant-baseline": "central",
        fill: BONE_INK,
        style: `${FONT}; font-size: 17px`,
      }, g);
      text.textContent = label;
      fitLabel(text);
      underline = el("line", { x1: 0, x2: 0, y1: 10, y2: 10, stroke: MINT, "stroke-width": 2.5, "stroke-linecap": "round", opacity: 0 }, g);
      document.fonts?.ready.then(() => fitLabel(text));
    } else {
      // Blank bones get a paw print.
      const paw = el("g", { fill: "#c7b38c" }, g);
      el("ellipse", { cx: 0, cy: 3, rx: 7, ry: 6 }, paw);
      for (const [x, y] of [[-8, -4], [-3, -8.5], [3, -8.5], [8, -4]]) el("circle", { cx: x, cy: y, r: 3 }, paw);
    }
    return { id, g, glow, underline, x: 0, y: -BONE_REST, r: 0, vx: 0, vy: 0, vr: 0, mode: "rest", slot: null, tween: null };
  };

  const placeBone = (b) => b.g.setAttribute("transform", tf(b.x, b.y, b.r));

  /**
   * Stack bones into a mound with a 1D height map: each bone rests on the
   * highest point under it, tilted to follow the slope. The winner (if any)
   * goes in about halfway through, on the right flank, with a few bones piled
   * on top of it for the dog to dig away.
   */
  const HM_X0 = PILE_X - PILE_HALF - 90;
  const HM_CELL = 6;
  const HM_N = Math.ceil((2 * PILE_HALF + 180) / HM_CELL);
  const layoutHeap = (list, winner) => {
    const hm = new Float32Array(HM_N);
    const idx = (x) => clamp(Math.round((x - HM_X0) / HM_CELL), 0, HM_N - 1);
    const restOn = (cx, r) => {
      const half = 63 * Math.abs(Math.cos(r)) + 26 * Math.abs(Math.sin(r));
      const i0 = idx(cx - half);
      const im = idx(cx);
      const i1 = idx(cx + half);
      let hL = 0;
      let hR = 0;
      for (let k = i0; k <= im; k++) hL = Math.max(hL, hm[k]);
      for (let k = im; k <= i1; k++) hR = Math.max(hR, hm[k]);
      const base = Math.max(hL, hR) - Math.abs(hR - hL) * 0.35;
      return { half, i0, i1, hL, hR, base: Math.max(base, BONE_REST - 9) };
    };
    const order = list.filter((b) => b !== winner).sort(() => Math.random() - 0.5);
    let at = -1;
    if (winner) {
      at = Math.round(order.length * 0.5);
      order.splice(at, 0, winner);
    }
    order.forEach((b, i) => {
      let cx;
      let r;
      if (b === winner) {
        cx = WINNER_X + rand(-6, 6);
        r = rand(-0.06, 0.06);
      } else if (winner && i > at && i <= at + 3) {
        cx = WINNER_X + rand(-45, 40);
        r = rand(-0.45, 0.45);
      } else {
        // Try a few spots; favour low ones near the middle.
        let best = null;
        for (let c = 0; c < 6; c++) {
          const x = PILE_X + rand(-1, 1) * PILE_HALF * 0.82;
          const score = restOn(x, 0).base + Math.abs(x - PILE_X) * 0.3;
          if (!best || score < best.score) best = { x, score };
        }
        cx = best.x;
        r = rand(-0.5, 0.5);
      }
      const rest = restOn(cx, r);
      r = clamp(-Math.atan2(rest.hR - rest.hL, 2 * rest.half) * 0.9 + r * 0.35, -0.7, 0.7);
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
    const labels = labelsFor(list);
    bones = list.map((p) => makeBone(p._id, labels.get(p._id)));
    for (let i = list.length; i < MIN_BONES; i++) bones.push(makeBone(`blank-${i}`, null));
    for (const b of layoutHeap(bones, null)) {
      Object.assign(b, { x: b.slot.x, y: b.slot.y, r: b.slot.r, mode: "rest" });
      pileLayer.appendChild(b.g);
      placeBone(b);
    }
  };

  // ---- effects ---------------------------------------------------------------
  const puffs = Array.from({ length: 28 }, () => ({
    node: el("circle", { r: 0, fill: "#d7e8df", opacity: 0 }, fxLayer),
    life: 0,
  }));
  const puff = (x, y, vx, vy) => {
    const p = puffs.find((q) => q.life <= 0);
    if (!p) return;
    Object.assign(p, { x, y, vx, vy, life: 1, size: rand(4, 7) });
  };
  const sparkles = Array.from({ length: 14 }, () => ({
    node: el("path", { d: STAR_PATH, fill: MINT, opacity: 0 }, fxLayer),
    life: 0,
  }));
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
  bang.textContent = "!";
  let bangT = -1;

  let lastClack = 0;
  const clack = (v) => {
    const now = performance.now();
    if (now - lastClack < 45) return;
    lastClack = now;
    callbacks.current.onClack?.(clamp(v, 0.1, 1));
  };

  // ---- camera ------------------------------------------------------------------
  let vw = 1;
  let vh = 1;
  const cam = { s: 1, cx: 0, cy: 0, ready: false };
  let camMode = "home";
  let camFocus = SPOT_X;

  const camTarget = () => {
    let rect = CAM_HOME;
    let focus = camFocus;
    if (camMode === "present") {
      rect = { x: SPOT_X - 135, y: -285, w: 290, h: 300 };
      focus = SPOT_X + 10;
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
      const k = 1 - Math.exp(-dt * 3.2);
      cam.s = Math.exp(lerp(Math.log(cam.s), Math.log(t.s), k));
      cam.cx = lerp(cam.cx, t.cx, k);
      cam.cy = lerp(cam.cy, t.cy, k);
    }
    world.setAttribute(
      "transform",
      `translate(${(vw / 2 - cam.cx * cam.s).toFixed(2)} ${(vh / 2 - cam.cy * cam.s).toFixed(2)}) scale(${cam.s.toFixed(4)})`
    );
  };

  // ---- timeline ----------------------------------------------------------------
  let mode = "idle"; // idle | busy | present
  let queue = [];
  let step = null;
  let clock = 0;
  let winnerBone = null;
  let shuffleLeft = 0;
  let digLaunches = [];
  let nextLaunch = 0;
  let presentT = 0;
  let nextBlink = 2;

  const call = (fn) => ({ start: fn, dur: 0 });
  const wait = (dur) => ({ dur });
  const waitFor = (pred) => ({ update: () => pred() });
  const blend = (target, dur) => ({
    start() {
      this.from = { sit: dog.sit, dig: dog.dig };
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
      dog.sy = 1 + 0.07 * Math.sin(Math.PI * k);
      if (k >= 1) {
        dog.facing = facing;
        dog.sy = 1;
      }
      return k >= 1;
    },
  });
  const runTo = (x) => ({
    start() {
      this.x0 = dog.x;
      this.dur = Math.max(0.35, Math.abs(x - dog.x) / RUN_SPEED + 0.25);
    },
    update(t, dt) {
      const k = Math.min(1, t / this.dur);
      const prev = dog.x;
      dog.x = lerp(this.x0, x, easeInOut(k));
      const moved = Math.abs(dog.x - prev);
      dog.speed = dt > 0 ? moved / dt : 0;
      dog.phase += (moved / GAIT_LENGTH) * Math.PI * 2;
      dog.gait = clamp(dog.speed / 120, 0, 1);
      dog.lean = clamp(dog.speed / 300, 0, 1);
      if (k >= 1) {
        dog.speed = 0;
        dog.gait = 0;
        dog.lean = 0;
      }
      return k >= 1;
    },
  });

  /** All bones hop into a fresh heap. This is the "mixing". */
  const shuffle = (winner) => {
    const order = layoutHeap(bones, winner);
    shuffleLeft = order.length;
    order.forEach((b, i) => {
      if (b.mode === "held") b.glow.setAttribute("opacity", 0);
      b.underline?.setAttribute("opacity", 0);
      pileLayer.appendChild(b.g);
      b.mode = "tween";
      b.tween = {
        from: { x: b.x, y: b.y, r: b.r },
        t: -i * (0.8 / order.length),
        dur: 0.5,
        arc: rand(70, 150),
        spin: Math.random() < 0.4 ? Math.PI * 2 * Math.sign(rand(-1, 1)) : 0,
      };
    });
  };

  /** Bones piled on top of the winner get flung out behind the dog. */
  const planLaunches = () => {
    const w = winnerBone.slot;
    digLaunches = bones
      .filter((b) => b !== winnerBone && b.slot.order > w.order && Math.abs(b.slot.x - w.x) < 120)
      .sort((a, b) => a.slot.y - b.slot.y)
      .slice(0, 6);
    nextLaunch = 0.15;
  };

  const launch = (b) => {
    frontLayer.appendChild(b.g);
    Object.assign(b, { mode: "fly", vx: rand(640, 880), vy: rand(-680, -540), vr: rand(-14, 14) });
    for (let i = 0; i < 3; i++) puff(b.x + rand(-20, 20), b.y + 10, rand(40, 160), rand(-120, -40));
  };

  const grab = () => ({
    start() {
      this.attached = false;
    },
    update(t) {
      // Plunge in, clamp onto the bone, pull it out with a toss of the head.
      if (t < 0.32) {
        const k = easeInOut(t / 0.32);
        dog.extraNeck = 0.25 * k;
        dog.extraHead = 0.35 * k;
      } else {
        if (!this.attached) {
          this.attached = true;
          frontLayer.appendChild(winnerBone.g);
          winnerBone.mode = "held";
          winnerBone.tween = { from: { x: winnerBone.x, y: winnerBone.y, r: winnerBone.r }, t: 0 };
          clack(0.7);
          for (let i = 0; i < 5; i++) puff(winnerBone.x + rand(-30, 30), winnerBone.y, rand(-80, 80), rand(-160, -60));
        }
        const k = Math.min(1, (t - 0.32) / 0.45);
        dog.extraNeck = lerp(0.25, -0.1, easeInOut(k));
        dog.extraHead = lerp(0.35, -0.3, easeInOut(k));
        dog.dig = 1 - easeInOut(k);
      }
      return t >= 0.8;
    },
    end() {
      dog.extraNeck = 0;
      dog.extraHead = -0.12; // proud, nose up, while it carries the bone
    },
  });

  const draw = (winner) => {
    if (pending) {
      rebuildBones(pending);
      pending = null;
    }
    winnerBone = bones.find((b) => b.id === winner._id);
    if (!winnerBone) {
      winnerBone = makeBone(winner._id, winner.firstName);
      bones.push(winnerBone);
    }
    mode = "busy";
    camMode = "home";
    presentT = 0;
    dog.tilt = 0;
    const digX = WINNER_X + digReach;
    queue = [
      call(() => {
        bangT = 0;
        dog.wagSpeed = 18;
        dog.wagAmp = 0.45;
        dog.extraHead = 0;
      }),
      blend({ sit: 0, dig: 0 }, 0.3),
      call(() => shuffle(winnerBone)),
      turnTo(-1),
      runTo(digX),
      waitFor(() => shuffleLeft <= 0),
      blend({ dig: 1 }, 0.3),
      call(() => {
        planLaunches();
        dog.scratch = 1;
      }),
      wait(2.1),
      call(() => (dog.scratch = 0)),
      grab(),
      turnTo(1),
      runTo(SPOT_X),
      blend({ sit: 1 }, 0.35),
      call(() => {
        mode = "present";
        camMode = "present";
        dog.wagSpeed = 13;
        dog.wagAmp = 0.35;
        callbacks.current.onLanded?.();
      }),
    ];
    step = null;
  };

  const reset = () => {
    queue = [];
    step = null;
    mode = "idle";
    camMode = "home";
    Object.assign(dog, { x: SPOT_X, facing: 1, sit: 1, dig: 0, gait: 0, scratch: 0, extraNeck: 0, extraHead: 0, tilt: 0 });
    rebuildBones(pending ?? latest);
    pending = null;
  };

  let latest = [];
  const setParticipants = (list) => {
    latest = list;
    // Mid-draw or while the winner is on show, apply it at the next draw.
    if (mode === "idle") rebuildBones(list);
    else pending = list;
  };

  // How far ahead of the dog its mouth reaches while digging: park the dog
  // so it lands right over the winner's bone.
  dog.sit = 0;
  dog.dig = 1;
  dog.extraNeck = 0.12;
  dog.extraHead = 0.18;
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
          if (b.vy > 140) clack(b.vy / 900);
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
        if (tw && tw.t < 0.14) {
          tw.t += dt;
          const k = easeInOut(Math.min(1, tw.t / 0.14));
          b.x = lerp(tw.from.x, mx, k);
          b.y = lerp(tw.from.y, my, k);
          b.r = lerp(tw.from.r, wobble, k);
        } else {
          b.x = mx;
          b.y = my;
          b.r = wobble;
        }
        placeBone(b);
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
    if (bangT >= 0) {
      bangT += dt;
      const [hx, hy] = toWorld(dog.headTop);
      const pop = bangT < 0.3 ? easeOutBack(bangT / 0.3) : 1;
      const fade = bangT < 0.8 ? 1 : Math.max(0, 1 - (bangT - 0.8) / 0.3);
      bang.setAttribute("transform", tf(hx, hy - 10 * pop, 0.12, pop, pop));
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

    // Digging: paws scratch, dust flies, covering bones get flung out.
    if (dog.scratch > 0) {
      const before = Math.floor(dog.scratchPhase / Math.PI);
      dog.scratchPhase += dt * 15;
      if (Math.floor(dog.scratchPhase / Math.PI) !== before) {
        callbacks.current.onScratch?.();
        const [px, py] = toWorld([digReach + 12, -10]);
        puff(px, py - rand(0, 20), -dog.facing * rand(20, 120), rand(-170, -80));
      }
      nextLaunch -= dt;
      if (nextLaunch <= 0 && digLaunches.length) {
        launch(digLaunches.shift());
        nextLaunch = 0.3;
      }
    }

    // Life: blinks, ears, head tilt while showing off the bone.
    nextBlink -= dt;
    if (nextBlink <= 0) {
      dog.blink = Math.min(1, dog.blink + dt * 14);
      if (dog.blink >= 1) nextBlink = rand(2.5, 5);
    } else dog.blink = Math.max(0, dog.blink - dt * 10);
    const earTarget =
      dog.dig > 0.5 ? 0.55 : 0.12 + 0.35 * Math.sin(dog.phase * 2) * dog.gait + 0.05 * Math.sin(clock * 1.7);
    dog.ear = lerp(dog.ear, earTarget, 1 - Math.exp(-dt * 10));
    if (mode === "idle") {
      dog.wagSpeed = lerp(dog.wagSpeed, 3, dt);
      dog.wagAmp = lerp(dog.wagAmp, 0.15, dt);
    }
    if (mode === "present") {
      presentT += dt;
      dog.tilt = 0.14 * easeInOut(Math.min(1, presentT / 0.6)) + 0.03 * Math.sin(clock * 1.3);
      const b = winnerBone;
      b.glow.setAttribute("opacity", (0.45 * Math.min(1, presentT / 0.5) + 0.1 * Math.sin(clock * 3)).toFixed(2));
      if (b.underline) {
        const w = 42 * easeInOut(clamp((presentT - 0.3) / 0.5, 0, 1));
        b.underline.setAttribute("opacity", w > 0.5 ? 1 : 0);
        b.underline.setAttribute("x1", (-w).toFixed(1));
        b.underline.setAttribute("x2", w.toFixed(1));
      }
      if (presentT < 2.2 && Math.random() < dt * 9) sparkle(b.x + rand(-80, 80), b.y + rand(-50, 30));
    }

    updateBones(dt);
    solveDog(clock);
    updateFx(dt);
    camFocus = mode === "busy" ? (dog.x + WINNER_X) / 2 : dog.x - 90;
    updateCamera(dt);
  };

  // ---- sizing / loop / teardown -----------------------------------------------
  const fit = () => {
    vw = host.clientWidth || 1;
    vh = host.clientHeight || 1;
    svg.setAttribute("viewBox", `0 0 ${vw} ${vh}`);
    cam.ready = false;
  };
  const ro = new ResizeObserver(fit);
  ro.observe(host);
  fit();

  let raf = 0;
  let last = 0;
  const frame = (ts) => {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(1 / 30, (ts - last) / 1000) : 1 / 60;
    last = ts;
    update(dt);
  };
  raf = requestAnimationFrame(frame);

  const dispose = () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    svg.remove();
  };

  return { draw, reset, setParticipants, dispose };
}
