/**
 * Raffle sound. Two kinds, all through one Web Audio graph:
 *
 * - Recorded samples (barks, whines, wooden clacks, paws) from a single sprite,
 *   public/sounds/sprite.mp3 (~130 KB, all public domain — see CREDITS.md),
 *   fetched and decoded once in the background.
 * - Synthesised sounds (drumroll, crash, whooshes, stings...) built live from
 *   filtered noise, oscillators and plucked-string synthesis.
 *
 * Nothing plays until the user has clicked something (browsers require a
 * gesture before an AudioContext may start), and everything respects mute.
 */
import { SPRITE_CLIPS, SPRITE_URL } from "./sound-sprite.js";

const STORAGE_KEY = "blackdog-raffle:sound";

let ctx = null;
let master = null;
let noise = null;

function ensureContext() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // A gentle limiter so a pile of simultaneous clacks never distorts.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    master.connect(limiter).connect(ctx.destination);
    // Development only: lets tests tap the output and measure levels.
    if (process.env.NODE_ENV !== "production") window.__raffleAudio = { ctx, output: limiter, loaded: () => Boolean(sprite) };

    // Half a second of white noise, reused for every click and thump.
    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

const ready = () => isSoundEnabled() && ensureContext();
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// ---- building blocks -----------------------------------------------------------

function noiseBurst({ at, duration, gain, filterType = "bandpass", frequency, q = 1 }) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = duration > 0.45; // the noise buffer is half a second long
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.003);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  src.connect(filter).connect(env).connect(master);
  src.start(at);
  src.stop(at + duration + 0.02);
}

function tone({ at, frequency, endFrequency, duration, gain, type = "sine", attack = 0.005, dest = master }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(env).connect(dest);
  osc.start(at);
  osc.stop(at + duration + 0.05);
  return osc;
}

/** Slow wobble on an oscillator's pitch (vibrato), in cents. */
function vibrato(osc, at, rate, cents, delay = 0) {
  const lfo = ctx.createOscillator();
  lfo.frequency.value = rate;
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, at);
  depth.gain.linearRampToValueAtTime(cents, at + delay + 0.1);
  lfo.connect(depth).connect(osc.detune);
  lfo.start(at);
  lfo.stop(at + 4);
}

// Plucked strings (Karplus–Strong): a burst of noise ringing in a tuned delay
// line. Buffers are cached per note.
const plucks = new Map();
function pluckBuffer(freq, seconds, damping) {
  const key = `${freq.toFixed(1)}:${seconds}:${damping}`;
  if (plucks.has(key)) return plucks.get(key);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const period = Math.max(2, Math.round(sr / freq));
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
  const out = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j = (j + 1) % period) {
    out[i] = line[j];
    line[j] = damping * 0.5 * (line[j] + line[(j + 1) % period]);
  }
  const buffer = ctx.createBuffer(1, n, sr);
  buffer.copyToChannel(out, 0);
  plucks.set(key, buffer);
  return buffer;
}

function pluck(freq, at, { gain = 0.2, seconds = 1.6, damping = 0.996, tone: cutoff = 3200 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(freq, seconds, damping);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(lp).connect(g).connect(master);
  src.start(at);
}

const strum = (freqs, at, spacing, opts) => freqs.forEach((f, i) => pluck(f, at + i * spacing, opts));

// ---- the sample sprite -----------------------------------------------------------

let sprite = null;
let spritePromise = null;

/** Fetch + decode the sample sprite in the background (no gesture needed). */
export function prefetchSounds() {
  if (typeof window === "undefined" || spritePromise) return spritePromise;
  const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Offline) return null;
  spritePromise = fetch(SPRITE_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`sprite ${res.status}`);
      return res.arrayBuffer();
    })
    .then((data) => new Promise((resolve, reject) => new Offline(1, 1, 44100).decodeAudioData(data, resolve, reject)))
    .then((buffer) => {
      sprite = buffer;
      return buffer;
    })
    .catch((err) => {
      console.warn("[sound] couldn't load samples:", err);
      spritePromise = null;
    });
  return spritePromise;
}

/** Play one clip from the sprite. If the sprite is still loading, play it as soon as it lands (if that's quick). */
function clip(name, { gain = 0.8, rate = 1, delay = 0 } = {}) {
  if (!ready()) return;
  const span = SPRITE_CLIPS[name];
  if (!span) return;
  if (!sprite) {
    const asked = performance.now();
    prefetchSounds()?.then(() => {
      if (sprite && performance.now() - asked < 300) clip(name, { gain, rate, delay });
    });
    return;
  }
  const src = ctx.createBufferSource();
  src.buffer = sprite;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + delay, span[0], span[1]);
}

/** Every clip name in the sprite (for the sound board). */
export const CLIP_NAMES = Object.keys(SPRITE_CLIPS);
export const playClip = (name, opts) => clip(name, opts);

// ---- preference store (usable with useSyncExternalStore) --------------------

const listeners = new Set();

export function isSoundEnabled() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Server snapshot: assume on, so SSR and first paint agree. */
export const isSoundEnabledOnServer = () => true;

export function setSoundEnabled(enabled) {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    /* private mode etc. */
  }
  listeners.forEach((fn) => fn());
}

export function subscribeSound(listener) {
  listeners.add(listener);
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Call from a click handler so the context exists before anything needs to play. */
export function unlockAudio() {
  ensureContext();
  prefetchSounds();
}

// ---- synthesised sounds -----------------------------------------------------------

/** Mechanical ratchet click (the reduced-motion name shuffle). `speed` 0..1. */
export function playTick(speed = 0.5) {
  if (!ready()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 0.035, gain: 0.07 + 0.16 * (1 - speed), frequency: 1600 + 1400 * speed, q: 2.5 });
  tone({ at: t, frequency: 700 + 300 * speed, duration: 0.03, gain: 0.05 + 0.05 * (1 - speed), type: "square" });
}

/** Two quick sniffs. */
export function playSniff() {
  if (!ready()) return;
  const t = ctx.currentTime;
  for (const dt of [0, 0.11]) {
    noiseBurst({ at: t + dt, duration: 0.07, gain: 0.17, filterType: "highpass", frequency: 2600, q: 0.7 });
  }
}

/** Cymbal crash: a long, bright noise wash over a low thump. */
export function playCrash() {
  if (!ready()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 1.6, gain: 0.16, filterType: "highpass", frequency: 5200, q: 0.5 });
  noiseBurst({ at: t, duration: 0.7, gain: 0.1, filterType: "bandpass", frequency: 3200, q: 0.6 });
  tone({ at: t, frequency: 120, endFrequency: 55, duration: 0.3, gain: 0.35 });
}

/**
 * Snare drumroll that speeds up and swells while it runs. Returns a stop
 * function (pass `true` to finish on a cymbal crash) with a `climax()` method
 * for the last second before the reveal: fastest and loudest.
 */
export function startDrumroll() {
  if (!ready()) return Object.assign(() => {}, { climax() {} });
  const started = ctx.currentTime;
  let stopped = false;
  let peak = false;
  let timer;
  const hit = () => {
    if (stopped) return;
    const t = ctx.currentTime;
    const build = Math.min(1, (t - started) / 7);
    if (isSoundEnabled()) {
      const swell = peak ? 1 : 0.25 + 0.6 * build;
      noiseBurst({
        at: t,
        duration: 0.07,
        gain: 0.08 + 0.3 * swell + Math.random() * 0.04,
        filterType: "bandpass",
        frequency: 1650 + Math.random() * 350,
        q: 0.9,
      });
      tone({ at: t, frequency: 185, duration: 0.05, gain: 0.045 + 0.13 * swell, type: "triangle" });
    }
    const interval = peak ? 30 : 64 - 22 * build; // ms between strokes
    timer = setTimeout(hit, interval * rand(0.9, 1.1));
  };
  hit();
  const stop = (crash = false) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (crash) playCrash();
  };
  stop.climax = () => {
    peak = true;
  };
  return stop;
}

/** A paw scraping through a pile: a short, dry noise swipe. */
export function playScratch() {
  if (!ready()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 0.09, gain: 0.27, filterType: "bandpass", frequency: 2200 + Math.random() * 900, q: 0.8 });
  noiseBurst({ at: t + 0.02, duration: 0.06, gain: 0.15, filterType: "lowpass", frequency: 700 });
}

/** A soft thunk (fallback when there's no drumroll to crash). */
export function playThunk() {
  if (!ready()) return;
  const t = ctx.currentTime;
  tone({ at: t, frequency: 140, endFrequency: 50, duration: 0.22, gain: 0.5, type: "sine" });
  noiseBurst({ at: t, duration: 0.09, gain: 0.3, filterType: "lowpass", frequency: 500 });
}

/** Winner fanfare: a bright rising arpeggio and a shimmer on top. */
export function playFanfare() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const at = t + i * 0.11;
    const last = i === notes.length - 1;
    tone({ at, frequency: f, duration: last ? 1.4 : 0.45, gain: 0.22, type: "triangle", attack: 0.01 });
    tone({ at, frequency: f * 2, duration: last ? 1.1 : 0.3, gain: 0.05, type: "sine", attack: 0.01 });
  });
  tone({ at: t + 0.3, frequency: 2400, endFrequency: 4800, duration: 0.9, gain: 0.03, type: "sine", attack: 0.2 });
  noiseBurst({ at: t + 0.33, duration: 0.5, gain: 0.05, filterType: "highpass", frequency: 6000 });
}

// ---- the dog and its bones ------------------------------------------------------------

/** Sound effects for the draw animation. Every call varies pitch a little so nothing repeats exactly. */
export const sfx = {
  bark: (o = {}) => clip(pick(["bark1", "bark2", "bark3", "bark4"]), { gain: 0.72, rate: rand(0.95, 1.08), ...o }),
  yip: (o = {}) => clip(pick(["yip1", "yip2", "yip3", "yip4", "yip5"]), { gain: 0.55, rate: rand(0.96, 1.12), ...o }),
  woof: (o = {}) => clip(pick(["woof1", "woof2"]), { gain: 0.75, rate: rand(0.9, 1.0), ...o }),
  whine: (o = {}) => clip(pick(["whine1", "whine2", "whine3"]), { gain: 0.6, rate: rand(0.96, 1.05), ...o }),
  howl: (o = {}) => clip("howl", { gain: 0.6, ...o }),
  pant: (o = {}) => clip("pant", { gain: 0.28, rate: rand(0.97, 1.03), ...o }),
  /** Bark then a yip: the "I got it!" at the reveal. */
  happyBarks(delay = 0) {
    sfx.bark({ delay });
    sfx.yip({ delay: delay + 0.2, rate: rand(1.02, 1.12) });
  },

  /** A bone landing. `intensity` 0..1; hard landings sometimes use the heavier plank. */
  clack(intensity = 0.5, delay = 0) {
    const name = intensity > 0.7 && Math.random() < 0.5 ? pick(["plank1", "plank2"]) : pick(["clack1", "clack2", "clack3", "clack4", "clack5"]);
    clip(name, { gain: 0.08 + 0.26 * intensity, rate: rand(0.92, 1.22), delay });
  },
  paw: (speed = 0.5) => clip(pick(["paw1", "paw2", "paw3"]), { gain: 0.1 + 0.2 * speed, rate: rand(1.0, 1.3) }),
  thud: (heavy = false) => clip(heavy ? "thudHeavy" : "thud", { gain: heavy ? 0.7 : 0.45, rate: rand(0.9, 1.1) }),
  /** The cannonball landing: a heavy thump and a cascade of bones. */
  avalanche() {
    clip("thudHeavy", { gain: 0.5, rate: rand(0.9, 1.05) });
    let at = 0.02;
    for (let i = 0; i < 16; i++) {
      sfx.clack(0.7 - i * 0.03, at);
      at += rand(0.02, 0.06) + i * 0.004;
    }
  },
  scratch: () => playScratch(),
  sniff: () => playSniff(),

  /** Air rushing past: a jump or a thrown bone. */
  whoosh(strength = 1) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const dur = 0.24 + 0.14 * strength;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1800 + 900 * strength, t + dur * 0.55);
    bp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * strength + 0.08, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  },

  /** Paws skidding on a shiny floor: a rubbery squeak over a scrape. */
  skid() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const osc = tone({ at: t, frequency: rand(2000, 2400), endFrequency: rand(1300, 1500), duration: 0.24, gain: 0.15, attack: 0.01 });
    vibrato(osc, t, 32, 70);
    noiseBurst({ at: t, duration: 0.22, gain: 0.2, filterType: "bandpass", frequency: 1200, q: 0.8 });
  },

  /** Ears flapping during a head shake: a low fluttery "brrrp". */
  earFlap() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 520;
    const flutter = ctx.createGain();
    flutter.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 21;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(flutter.gain);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(1.5, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(lp).connect(flutter).connect(env).connect(master);
    src.start(t);
    lfo.start(t);
    src.stop(t + 0.65);
    lfo.stop(t + 0.65);
  },

  /** A bright little bell for the "!" over the dog's head. */
  ting() {
    if (!ready()) return;
    const t = ctx.currentTime;
    const f = rand(1500, 1700);
    tone({ at: t, frequency: f, duration: 0.6, gain: 0.14 });
    tone({ at: t, frequency: f * 2.76, duration: 0.3, gain: 0.05 });
    tone({ at: t, frequency: f * 5.4, duration: 0.15, gain: 0.024 });
  },

  /** Sad trombone for the fake-out: wah, wah, wah, wahhhh. */
  wahwah() {
    if (!ready()) return;
    const t = ctx.currentTime + 0.05;
    const notes = [
      [233.1, 0, 0.32],
      [220.0, 0.34, 0.32],
      [207.7, 0.68, 0.32],
      [196.0, 1.02, 0.95],
    ];
    for (const [f, dt, dur] of notes) {
      const at = t + dt;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 6;
      lp.frequency.setValueAtTime(350, at);
      lp.frequency.exponentialRampToValueAtTime(1500, at + 0.09);
      lp.frequency.exponentialRampToValueAtTime(500, at + dur);
      lp.connect(master);
      const osc = tone({ at, frequency: f, duration: dur, gain: 0.22, type: "sawtooth", attack: 0.03, dest: lp });
      if (dur > 0.5) vibrato(osc, at, 6, 35, 0.15);
    }
  },
};

// ---- winner stings, one per seasonal skin ------------------------------------------------

const STINGS = {
  // Spooky organ chord and a howl.
  halloween(t) {
    for (const f of [220, 261.63, 329.63, 440]) {
      for (const cents of [-6, 6]) {
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1500;
        lp.connect(master);
        const osc = tone({ at: t, frequency: f, duration: 2.2, gain: 0.015, type: cents < 0 ? "square" : "sawtooth", attack: 0.15, dest: lp });
        osc.detune.value = cents;
        vibrato(osc, t, 5.5, 12, 0.2);
      }
    }
    sfx.howl({ delay: 0.35, gain: 0.35 });
  },
  // Sleigh bells and a glockenspiel.
  holiday(t) {
    for (let s = 0; s < 12; s++) {
      const at = t + s * 0.12 + (s % 2 ? 0.02 : 0);
      for (let j = 0; j < 4; j++) {
        for (const p of [2890, 4130, 5460]) tone({ at: at + rand(0, 0.02), frequency: p * rand(0.97, 1.03), duration: 0.16, gain: 0.024 });
      }
    }
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => {
      tone({ at: t + 0.1 + i * 0.13, frequency: f, duration: 0.9, gain: 0.18 });
      tone({ at: t + 0.1 + i * 0.13, frequency: f * 3, duration: 0.3, gain: 0.04 });
    });
  },
  // Party horn and some poppers.
  newyear(t) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1900;
    lp.connect(master);
    for (const type of ["sawtooth", "square"]) {
      const osc = tone({ at: t, frequency: 290, endFrequency: 370, duration: 0.75, gain: 0.17, type, attack: 0.02, dest: lp });
      vibrato(osc, t, 9, 25, 0.2);
    }
    for (const dt of [0.55, 0.8, 1.0]) {
      noiseBurst({ at: t + dt, duration: 0.12, gain: 0.12, filterType: "highpass", frequency: 1500 });
      noiseBurst({ at: t + dt + 0.03, duration: 0.4, gain: 0.04, filterType: "highpass", frequency: 5000 });
    }
  },
  // A harp glissando.
  valentines(t) {
    [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1568, 1760, 2093].forEach((f, i) =>
      pluck(f, t + i * 0.055, { gain: 0.32, seconds: 1.8, damping: 0.997, tone: 5000 })
    );
  },
  // A tin-whistle jig.
  stpatricks(t) {
    const notes = [587.33, 659.25, 739.99, 880, 987.77, 880, 739.99, 587.33];
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      const at = t + i * 0.11;
      const osc = tone({ at, frequency: f, duration: last ? 0.8 : 0.12, gain: 0.22, attack: 0.01 });
      tone({ at, frequency: f * 2, duration: last ? 0.6 : 0.1, gain: 0.04, type: "triangle", attack: 0.01 });
      if (last) vibrato(osc, at, 6, 20, 0.1);
    });
  },
  // Birdsong.
  spring(t) {
    let at = t;
    for (let i = 0; i < 9; i++) {
      const f = rand(2300, 3000);
      tone({ at, frequency: f, endFrequency: f * rand(1.35, 1.6), duration: 0.07, gain: 0.4, attack: 0.004 });
      at += i === 4 ? 0.3 : rand(0.07, 0.12);
    }
  },
  // A happy ukulele strum.
  summer(t) {
    const chord = [392, 261.63, 329.63, 440]; // G C E A (C6 shape)
    strum(chord, t, 0.022, { gain: 0.28, seconds: 1.2, damping: 0.994 });
    strum([...chord].reverse(), t + 0.26, 0.018, { gain: 0.18, seconds: 1.0, damping: 0.994 });
    strum(chord, t + 0.52, 0.022, { gain: 0.28, seconds: 1.8, damping: 0.995 });
  },
  // A warm acoustic-guitar strum.
  autumn(t) {
    const chord = [82.41, 123.47, 164.81, 196, 246.94, 329.63]; // E minor
    strum(chord, t, 0.035, { gain: 0.25, seconds: 2.4, damping: 0.997, tone: 2400 });
    strum(chord.slice(2), t + 0.6, 0.03, { gain: 0.14, seconds: 1.6, damping: 0.996, tone: 2400 });
  },
};

/** The music for the winner reveal: the fanfare, or the season's sting. */
export function playWinnerSting(theme) {
  if (!ready()) return;
  const sting = theme && Object.hasOwn(STINGS, theme) ? STINGS[theme] : null;
  if (sting) sting(ctx.currentTime + 0.05);
  else playFanfare();
}

export const STING_THEMES = Object.keys(STINGS);
