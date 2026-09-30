/**
 * Raffle sound. Two kinds, all through one Web Audio graph:
 *
 * - Recorded samples (barks, whines, wooden clacks, paws, and seasonal sleigh
 *   bells, blackbirds, thunder, dry leaves, a champagne cork, party horns) from a single sprite,
 *   public/sounds/sprite.mp3 (~260 KB, all public domain — see CREDITS.md),
 *   fetched and decoded once in the background.
 * - Synthesised sounds (suspense music, whooshes, organ, harp, ukulele...) built
 *   live from filtered noise, oscillators and plucked-string synthesis.
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

function noiseBurst({ at, duration, gain, filterType = "bandpass", frequency, q = 1, dest = master }) {
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
  src.connect(filter).connect(env).connect(dest);
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
// The delay line is a whole number of samples long and the loop filter adds a
// fraction of one, so each buffer comes with the playback rate that puts it in tune.
// A "finger" pluck starts from the string's plucked shape (a triangle, slightly
// rounded) instead of a burst of noise, and loses its overtones more slowly:
// round and warm but still clear, like a harp's gut strings. `bright` (0–1)
// plucks nearer the bridge with more bite, for ukulele and guitar.
const plucks = new Map();
function pluckBuffer(freq, seconds, damping, finger = false, bright = 0) {
  const key = `${freq.toFixed(1)}:${seconds}:${damping}:${finger}:${bright}`;
  if (plucks.has(key)) return plucks.get(key);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const period = Math.max(2, Math.round(sr / freq));
  const line = new Float32Array(period);
  if (finger) {
    const at = Math.max(1, Math.round(period * (0.15 - 0.07 * bright)));
    const grit = 0.18 + 0.35 * bright;
    for (let i = 0; i < period; i++) line[i] = (i < at ? i / at : (period - i) / (period - at)) + grit * (Math.random() * 2 - 1);
    const mean = line.reduce((a, v) => a + v, 0) / period;
    if (bright < 0.5) {
      for (let i = 0; i < period; i++) line[i] = (line[(i + period - 1) % period] + 2 * line[i] + line[(i + 1) % period]) / 4;
    }
    for (let i = 0; i < period; i++) line[i] = (line[i] - mean) * 1.6;
  } else {
    for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
  }
  const out = new Float32Array(n);
  const blend = finger ? 0.2 : 0.5; // how much each pass smooths the string (0.5 = classic Karplus–Strong)
  for (let i = 0, j = 0; i < n; i++, j = (j + 1) % period) {
    out[i] = line[j];
    line[j] = damping * ((1 - blend) * line[j] + blend * line[(j + 1) % period]);
  }
  const buffer = ctx.createBuffer(1, n, sr);
  buffer.copyToChannel(out, 0);
  const made = { buffer, rate: (freq * (period + blend)) / sr };
  plucks.set(key, made);
  return made;
}

function pluck(freq, at, { gain = 0.2, seconds = 1.6, damping = 0.996, tone: cutoff = 3200, finger = false, bright = 0, dest = master } = {}) {
  const src = ctx.createBufferSource();
  const { buffer, rate } = pluckBuffer(freq, seconds, damping, finger, bright);
  src.buffer = buffer;
  src.playbackRate.value = rate;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(lp).connect(g).connect(dest);
  src.start(at);
}

// A small concert hall (a synthetic reverb), made once, for music that wants some air.
let hall = null;
function room() {
  if (hall) return hall;
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * 2.2);
  const ir = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = Math.floor(sr * 0.012); i < n; i++) {
      lp += 0.3 * (Math.random() * 2 - 1 - lp); // a darker tail than plain noise
      d[i] = lp * Math.exp((-6.5 * i) / n);
    }
  }
  hall = ctx.createConvolver();
  hall.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.9;
  hall.connect(wet).connect(master);
  return hall;
}

/** A bus that plays dry and sends some of itself into the hall. */
function withRoom(send = 0.35) {
  const bus = ctx.createGain();
  bus.connect(master);
  const s = ctx.createGain();
  s.gain.value = send;
  bus.connect(s).connect(room());
  return bus;
}

// A pipe organ's full chorus (the 8', 4', 2 2/3', 2' and higher ranks) as one waveform.
let organWave = null;
function organ(freq, at, duration, gain, dest) {
  organWave ??= ctx.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, 0.55, 0.32, 0.28, 0.12, 0.1, 0, 0.08]));
  for (const cents of [-4, 4]) {
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(organWave);
    osc.frequency.value = freq;
    osc.detune.value = cents;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.035);
    env.gain.setValueAtTime(gain, at + duration);
    env.gain.linearRampToValueAtTime(0, at + duration + 0.12);
    osc.connect(env).connect(dest);
    osc.start(at);
    osc.stop(at + duration + 0.15);
  }
  // the breathy "chiff" as the pipe speaks
  noiseBurst({ at, duration: 0.05, gain: gain * 0.5, frequency: Math.min(freq * 4, 6000), q: 2, dest });
}

// Two seconds of softer, brownish noise for wind (the half-second white noise
// buffer would audibly repeat under a long gust).
let windNoise = null;
function wind(at, seconds, gain, dest = master) {
  if (!windNoise) {
    windNoise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = windNoise.getChannelData(0);
    let v = 0;
    for (let i = 0; i < d.length; i++) {
      v = 0.97 * v + 0.03 * (Math.random() * 2 - 1);
      d[i] = v * 6;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = windNoise;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.2;
  bp.frequency.setValueAtTime(300, at);
  bp.frequency.linearRampToValueAtTime(800, at + seconds * 0.45);
  bp.frequency.linearRampToValueAtTime(400, at + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + seconds * 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  src.connect(bp).connect(g).connect(dest);
  src.start(at);
  src.stop(at + seconds + 0.05);
}

/**
 * A low whistle playing `tune` ([note, eighths, cut?]) legato, the way a
 * whistle player does: the pitch jumps between notes, repeated notes are
 * tongued, a "cut" flicks a note above for an instant, and the last note gets
 * vibrato. Breath noise follows the pitch.
 */
function whistle(tune, at, eighth, gain, dest) {
  const wave = ctx.createPeriodicWave(new Float32Array(4), new Float32Array([0, 1, 0.12, 0.05]));
  const osc = ctx.createOscillator();
  osc.setPeriodicWave(wave);
  const env = ctx.createGain();
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 5;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.12;
  osc.connect(env);
  air.connect(bp).connect(airGain).connect(env);
  env.connect(dest);
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(gain, at + 0.03);
  let t = at;
  let prev = null;
  for (const [f, eighths, cut] of tune) {
    if (cut) {
      osc.frequency.setValueAtTime(f * 1.122, t); // a whole step above, for an instant
      osc.frequency.setValueAtTime(f, t + 0.03);
    } else {
      osc.frequency.setValueAtTime(f, t);
      if (f === prev && t > at) {
        // tongue the repeat: a quick dip in the air
        env.gain.setValueAtTime(gain, t - 0.02);
        env.gain.linearRampToValueAtTime(gain * 0.3, t);
        env.gain.linearRampToValueAtTime(gain, t + 0.025);
      }
    }
    bp.frequency.setValueAtTime(f * 2, t);
    prev = f;
    t += eighths * eighth;
  }
  const lastLength = tune.at(-1)[1] * eighth;
  vibrato(osc, t - lastLength, 5.5, 20, 0.12);
  env.gain.setValueAtTime(gain, t - 0.25);
  env.gain.linearRampToValueAtTime(0, t);
  osc.start(at);
  air.start(at);
  osc.stop(t + 0.05);
  air.stop(t + 0.05);
}

/**
 * A breathy, sax-like reed note: two saw waves through a filter that opens as
 * the note speaks, a little scoop up into the pitch, and breath noise. With
 * `trill`, it alternates with that note instead.
 */
function reed(freq, at, dur, gain, dest, trill = null) {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 2.5;
  lp.frequency.setValueAtTime(700, at);
  lp.frequency.linearRampToValueAtTime(2300, at + 0.03);
  lp.frequency.exponentialRampToValueAtTime(1100, at + Math.max(0.1, dur));
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.02);
  env.gain.setValueAtTime(gain, at + Math.max(0.03, dur * 0.7));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.05);
  lp.connect(env).connect(dest);
  for (const cents of [-5, 5]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(freq * 0.985, at);
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.04);
    if (trill) for (let k = 1, x = at + 0.07; x < at + dur; k++, x += 0.065) osc.frequency.setValueAtTime(k % 2 ? trill : freq, x);
    else if (dur > 0.4) vibrato(osc, at, 5, 14, 0.25);
    osc.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }
  noiseBurst({ at, duration: dur, gain: gain * 0.25, frequency: Math.min(freq * 3, 5000), q: 4, dest });
}

/** A finger snap. */
function snap(at, gain, dest) {
  noiseBurst({ at, duration: 0.045, gain, frequency: 2300, q: 1.4, dest });
  noiseBurst({ at, duration: 0.012, gain: gain * 0.5, filterType: "highpass", frequency: 5000, dest });
}

/** One glockenspiel note: a struck metal bar (partials at 1, 2.76 and 5.4 times the note). */
function glock(freq, at, gain, dest, ring = 1.4) {
  tone({ at, frequency: freq, duration: ring, gain, attack: 0.002, dest });
  tone({ at, frequency: freq * 2.76, duration: ring * 0.3, gain: gain * 0.28, attack: 0.001, dest });
  tone({ at, frequency: freq * 5.4, duration: ring * 0.1, gain: gain * 0.1, attack: 0.001, dest });
}

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

/** The accent at the reveal after gentle suspense: a softer crash with a bright "ta-da" chime. */
export function playRevealHit() {
  if (!ready()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 1.3, gain: 0.08, filterType: "highpass", frequency: 5600, q: 0.5 });
  tone({ at: t, frequency: 110, endFrequency: 55, duration: 0.25, gain: 0.2 });
  for (const [f, g] of [
    [1046.5, 0.1],
    [1568, 0.07],
    [2093, 0.04],
  ]) {
    tone({ at: t + 0.01, frequency: f, duration: 1.1, gain: g });
    tone({ at: t + 0.01, frequency: f * 2.76, duration: 0.25, gain: g * 0.25 });
  }
}

const silentSuspense = () => Object.assign(() => {}, { climax() {} });

/**
 * Snare drumroll that speeds up and swells while it runs. Returns a stop
 * function (pass `true` to finish on a cymbal crash) with a `climax()` method
 * for the last second before the reveal: fastest and loudest. `soft` is a
 * quieter, brushier version.
 */
export function startDrumroll({ soft = false } = {}) {
  if (!ready()) return silentSuspense();
  const level = soft ? 0.25 : 1;
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
        gain: level * (0.08 + 0.3 * swell + Math.random() * 0.04),
        filterType: "bandpass",
        frequency: (soft ? 3000 : 1650) + Math.random() * 350,
        q: 0.9,
      });
      tone({ at: t, frequency: 185, duration: 0.05, gain: level * (0.045 + 0.13 * swell), type: "triangle" });
    }
    const interval = peak ? 30 : 64 - 22 * build; // ms between strokes
    timer = setTimeout(hit, interval * rand(0.9, 1.1));
  };
  hit();
  const stop = (crash = false) => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    if (crash) (soft ? playRevealHit : playCrash)();
  };
  stop.climax = () => {
    peak = true;
  };
  return stop;
}

// ---- suspense while the dog searches (three styles to choose from) ---------------------------

const SUSPENSE_KEY = "blackdog-raffle:suspense";

export const SUSPENSE_STYLES = [
  { id: "swell", label: "Soft swell", hint: "A warm chord that slowly swells and brightens, with a faint quickening heartbeat" },
  { id: "music", label: "Sneaky jazz", hint: "An original cool-jazz tiptoe: swung bass, finger snaps and a breathy sax-like lead" },
  { id: "drumroll", label: "Soft drumroll", hint: "The drumroll, about 10 dB quieter and brushier" },
];
export const DEFAULT_SUSPENSE = "swell";

export function getSuspenseStyle() {
  try {
    const v = window.localStorage.getItem(SUSPENSE_KEY);
    return SUSPENSE_STYLES.some((st) => st.id === v) ? v : DEFAULT_SUSPENSE;
  } catch {
    return DEFAULT_SUSPENSE;
  }
}

const styleListeners = new Set();

export function setSuspenseStyle(id) {
  try {
    window.localStorage.setItem(SUSPENSE_KEY, id);
  } catch {
    /* private mode etc. */
  }
  styleListeners.forEach((fn) => fn());
}

export function subscribeSuspenseStyle(listener) {
  styleListeners.add(listener);
  return () => styleListeners.delete(listener);
}

/** Run `tick(until)` to schedule notes a little ahead of time; returns a stop function. */
function lookahead(tick) {
  let timer;
  let stopped = false;
  const loop = () => {
    if (stopped) return;
    tick(ctx.currentTime + 0.25);
    timer = setTimeout(loop, 60);
  };
  loop();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

/**
 * A gain bus for one piece of suspense: it grows from `from` to `to` over
 * `seconds` (the crescendo), `swellTo()` pushes it further at the climax,
 * `follow()` mutes it while sound is switched off mid-draw, and `fadeOut()`
 * ends it cleanly at the reveal. Notes go into `bus`.
 */
function suspenseBus({ from, to, seconds }) {
  const bus = ctx.createGain();
  const t0 = ctx.currentTime;
  bus.gain.setValueAtTime(from, t0);
  bus.gain.linearRampToValueAtTime(to, t0 + seconds);
  const mute = ctx.createGain();
  let on = isSoundEnabled();
  mute.gain.value = on ? 1 : 0;
  bus.connect(mute).connect(master);
  const follow = () => {
    if (on === isSoundEnabled()) return;
    on = !on;
    mute.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.05);
  };
  const swellTo = (value, rampSeconds) => {
    const t = ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(value, t + rampSeconds);
  };
  const fadeOut = (fade = 0.25) => {
    swellTo(0, fade); // then let go of the nodes
    setTimeout(() => mute.disconnect(), (fade + 0.5) * 1000);
  };
  return { bus, follow, swellTo, fadeOut };
}

/** A gentle rising shimmer for the last second before the reveal. */
function riser(at, seconds, dest) {
  const osc = tone({ at, frequency: 300, endFrequency: 1200, duration: seconds, gain: 0.03, attack: seconds * 0.8, dest });
  vibrato(osc, at, 7, 15, 0.2);
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2;
  bp.frequency.setValueAtTime(800, at);
  bp.frequency.exponentialRampToValueAtTime(7000, at + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.05, at + seconds);
  src.connect(bp).connect(g).connect(dest);
  src.start(at);
  src.stop(at + seconds + 0.05);
}

/**
 * "Sneaky music": an original cool-jazz tiptoe. A swung pizzicato bass walks
 * on its toes with finger snaps on 2 and 4; a breathy, sax-like lead joins with
 * a bluesy phrase the second time round, and brushes the third. It picks up a
 * little each loop. At the climax the bass creeps up in half steps under a trill.
 */
function startSneakyMusic() {
  const { bus, follow, swellTo, fadeOut } = suspenseBus({ from: 0.34, to: 0.64, seconds: 9 });
  const room = withRoom(0.2);
  room.disconnect();
  room.connect(bus); // the lead and snaps get some air, still under the bus's control
  // one bass note per beat, two bars: E G A A# | B A G F#
  const BASS = [82.41, 98, 110, 116.54, 123.47, 110, 98, 92.5];
  // the lead, in swung eighths: [step 0–15, note, length in eighths]
  const LEAD = [
    [0, 329.63, 0.7], [2, 392, 0.7], [3, 440, 0.7], [4, 493.88, 1.8], [7, 587.33, 0.7],
    [8, 493.88, 0.7], [10, 440, 0.7], [11, 392, 0.7], [12, 329.63, 3],
  ];
  const bass = (f, at, ring = 0.45) => {
    pluck(f, at, { gain: 0.11, seconds: ring, damping: 0.992, tone: 1500, finger: true, bright: 0.5, dest: bus });
    pluck(f * 2, at, { gain: 0.03, seconds: ring * 0.6, damping: 0.99, tone: 1500, finger: true, bright: 0.5, dest: bus }); // so small speakers still hear it
  };
  let next = ctx.currentTime + 0.05;
  let step = 0;
  let peak = false;
  const stopTicking = lookahead((until) => {
    follow();
    while (!peak && next < until) {
      const loop = Math.floor(step / 16);
      const s = step % 16;
      const beat = 0.5 / (1 + Math.min(loop, 3) * 0.04);
      const at = next;
      if (s % 2 === 0) bass(BASS[s / 2], at);
      if (s % 4 === 2) snap(at, 0.1 + 0.015 * Math.min(loop, 2), room); // beats 2 and 4
      if (loop >= 2 && s % 2 === 0) noiseBurst({ at, duration: beat * 0.6, gain: 0.012, frequency: 4500, q: 0.7, dest: bus }); // brushes
      if (loop >= 1) {
        for (const [ls, f, eighths] of LEAD) if (ls === s) reed(f, at, (eighths * beat) / 2, 0.035, room);
      }
      next += s % 2 === 0 ? (beat * 2) / 3 : beat / 3; // swing: long-short
      step += 1;
    }
  });
  const stop = (hit = false) => {
    stopTicking();
    fadeOut(0.2);
    if (hit) playRevealHit();
  };
  stop.climax = () => {
    if (peak) return;
    peak = true;
    swellTo(0.75, 0.9);
    const at = Math.max(next, ctx.currentTime + 0.02);
    [82.41, 87.31, 92.5, 98, 103.83, 110, 116.54, 123.47].forEach((f, i) => bass(f, at + i * 0.12, 0.3));
    reed(493.88, at, 1.0, 0.04, room, 523.25);
    riser(at + 0.3, 1.0, bus);
  };
  return stop;
}

/**
 * "Soft swell": a warm Dm9 chord that fades in and slowly opens up, over a
 * faint heartbeat that quickens as the search goes on.
 */
function startSwell() {
  const { bus, follow, swellTo, fadeOut } = suspenseBus({ from: 0.5, to: 1, seconds: 9 });
  const t0 = ctx.currentTime;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(350, t0);
  lp.frequency.exponentialRampToValueAtTime(1600, t0 + 10);
  const pad = ctx.createGain();
  pad.gain.setValueAtTime(0.0001, t0);
  pad.gain.exponentialRampToValueAtTime(1, t0 + 2.5);
  lp.connect(pad).connect(bus);
  const voices = [];
  for (const f of [146.83, 220, 261.63, 329.63, 349.23]) {
    for (const cents of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = f;
      osc.detune.value = cents;
      const g = ctx.createGain();
      g.gain.value = 0.022;
      osc.connect(g).connect(lp);
      osc.start(t0);
      voices.push(osc);
    }
  }
  let beat = t0 + 0.6;
  let peak = false;
  const stopBeats = lookahead((until) => {
    follow();
    while (beat < until) {
      // starts high enough in pitch for laptop speakers to carry it, then drops
      tone({ at: beat, frequency: 95, endFrequency: 45, duration: 0.15, gain: 0.09, dest: bus });
      tone({ at: beat + 0.19, frequency: 85, endFrequency: 45, duration: 0.13, gain: 0.055, dest: bus });
      const age = beat - t0;
      beat += peak ? 0.42 : Math.max(0.6, 0.95 - age * 0.03);
    }
  });
  const stop = (hit = false) => {
    stopBeats();
    fadeOut(0.3);
    const end = ctx.currentTime + 0.4;
    voices.forEach((v) => v.stop(end));
    if (hit) playRevealHit();
  };
  stop.climax = () => {
    if (peak) return;
    peak = true;
    swellTo(1.3, 1);
    const t = ctx.currentTime;
    lp.frequency.cancelScheduledValues(t);
    lp.frequency.setValueAtTime(lp.frequency.value, t);
    lp.frequency.exponentialRampToValueAtTime(3200, t + 1.2);
    riser(t + 0.2, 1.2, bus);
  };
  return stop;
}

/** Start the suspense while the dog searches; returns stop(hit) with a climax() method. */
export function startSuspense(style = getSuspenseStyle()) {
  if (!ready()) return silentSuspense();
  if (style === "drumroll") return startDrumroll({ soft: true });
  if (style === "music") return startSneakyMusic();
  return startSwell();
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
/**
 * One brass note: three slightly detuned saw waves through a filter that
 * "blats" open as the note speaks, a lip scoop up into the pitch, and vibrato
 * on long notes.
 */
function brass(freq, at, dur, gain, dest) {
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.Q.value = 1.2;
  lp.frequency.setValueAtTime(freq * 1.5, at);
  lp.frequency.linearRampToValueAtTime(Math.min(freq * 7, 6000), at + 0.04);
  lp.frequency.exponentialRampToValueAtTime(Math.min(freq * 4, 4500), at + Math.max(0.12, dur * 0.6));
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.025);
  env.gain.exponentialRampToValueAtTime(gain * 0.8, at + 0.12);
  env.gain.setValueAtTime(gain * 0.8, at + Math.max(0.13, dur));
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.1);
  lp.connect(env).connect(dest);
  for (const cents of [-7, 0, 7]) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(freq * 0.97, at);
    osc.frequency.exponentialRampToValueAtTime(freq, at + 0.035);
    if (dur > 0.5) vibrato(osc, at, 5.5, 12, 0.3);
    osc.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.15);
  }
}

/**
 * The brand look's winner music: a brass fanfare. A "ta-ta-ta" pickup climbs
 * to a held C major chord (ta-ta-ta TAA-ta-TAAAA) over a snare pickup, a
 * timpani hit and a soft cymbal, with a glockenspiel sparkle on top.
 */
export function playFanfare() {
  if (!ready()) return;
  const t = ctx.currentTime + 0.05;
  const bus = withRoom(0.3);
  const trip = 0.085;
  // the trumpet line
  [392, 392, 392].forEach((f, i) => brass(f, t + i * trip, 0.06, 0.05, bus));
  const up = t + 3 * trip;
  brass(523.25, up, 0.24, 0.055, bus);
  brass(659.25, up + 0.27, 0.11, 0.05, bus);
  const hold = up + 0.4;
  brass(783.99, hold, 1.1, 0.06, bus);
  // the section joins on the held chord: C5 E5 under the top, trombones below
  for (const [f, g] of [[659.25, 0.035], [523.25, 0.035], [392, 0.03], [261.63, 0.035], [130.81, 0.04]]) brass(f, hold, 1.0, g, bus);
  // drums: a snare under the pickup, then timpani and a soft cymbal on the chord
  for (let i = 0; i < 3; i++) {
    noiseBurst({ at: t + i * trip, duration: 0.08, gain: 0.07 + i * 0.02, frequency: 1900, q: 0.8, dest: bus });
    tone({ at: t + i * trip, frequency: 200, endFrequency: 160, duration: 0.06, gain: 0.05, dest: bus });
  }
  for (const at of [up, hold]) {
    tone({ at, frequency: 98, endFrequency: 92, duration: 0.9, gain: 0.2, dest: bus });
    tone({ at, frequency: 196, endFrequency: 188, duration: 0.5, gain: 0.07, dest: bus });
    noiseBurst({ at, duration: 0.05, gain: 0.05, filterType: "lowpass", frequency: 800, dest: bus });
  }
  noiseBurst({ at: hold, duration: 1.4, gain: 0.05, filterType: "highpass", frequency: 5500, q: 0.5, dest: bus });
  // and a sparkle
  [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => glock(f, hold + 0.12 + i * 0.06, 0.035, bus, 0.9));
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
  // Rolling thunder, then the opening of Bach's Toccata in D minor on a pipe
  // organ in a big stone hall, landing on a low D minor chord, and a howl.
  halloween(t) {
    clip("thunder", { gain: 0.5, delay: t - ctx.currentTime });
    const bus = withRoom(0.8);
    const both = (f, at, dur, gain = 0.042) => {
      organ(f, at, dur, gain, bus);
      organ(f / 2, at, dur, gain * 0.8, bus); // in octaves
    };
    const A = 880, G = 783.99, F = 698.46, E = 659.25, D = 587.33, Cs = 554.37;
    let at = t + 0.2;
    // [note, how long it sounds, time to the next one]: A-G-A... G F E D C#
    const MOTIF = [[A, 0.08, 0.09], [G, 0.08, 0.09], [A, 0.8, 1.05], [G, 0.09, 0.1], [F, 0.09, 0.1], [E, 0.09, 0.1], [D, 0.09, 0.1], [Cs, 0.34, 0.4]];
    for (const [f, dur, next] of MOTIF) {
      both(f, at, dur);
      at += next;
    }
    both(D, at, 1.5);
    [73.42, 146.83, 349.23, 440].forEach((f) => organ(f, at, 1.5, f < 100 ? 0.07 : 0.03, bus)); // pedal D under D minor
    sfx.howl({ delay: at - ctx.currentTime + 0.6, gain: 0.3 });
  },
  // Real sleigh bells, with "Jingle Bells" on a glockenspiel in time with them.
  holiday(t) {
    // The recording shakes every 0.665 s; played 1.2x faster that's one shake per two beats.
    const beat = 0.665 / 1.2 / 2;
    clip("sleighbells", { gain: 0.28, rate: 1.2, delay: t - ctx.currentTime });
    const E = 1318.5, G = 1567.98, C = 1046.5, D = 1174.66;
    const TUNE = [
      [E, 1], [E, 1], [E, 2], // jin-gle bells,
      [E, 1], [E, 1], [E, 2], // jin-gle bells,
      [E, 1], [G, 1], [C, 1.5], [D, 0.5], [E, 4], // jin-gle all the way
    ];
    const bus = withRoom(0.3);
    let at = t + 0.03;
    for (const [f, beats] of TUNE) {
      const last = beats === 4;
      glock(f, at, last ? 0.16 : 0.14, bus, last ? 2 : 1.1);
      if (last) [C / 2, G / 2].forEach((low) => glock(low, at, 0.06, bus, 2)); // land on a C major chord
      at += beats * beat;
    }
  },
  // A champagne cork, then a party horn: a short toot and a long one.
  newyear(t) {
    const in_ = (s) => t + s - ctx.currentTime;
    clip("cork", { gain: 0.5, delay: in_(0) });
    clip("horn1", { gain: 0.3, delay: in_(0.32) });
    clip("horn2", { gain: 0.3, delay: in_(0.78) });
    // a little confetti glitter after the pop
    for (let i = 0; i < 7; i++) tone({ at: t + 0.12 + i * rand(0.05, 0.09), frequency: rand(3500, 6000), duration: 0.12, gain: 0.012 });
  },
  // A harp: a soft glissando up a C major 9 chord, then a rolled chord that rings in the hall.
  valentines(t) {
    const bus = withRoom(0.45);
    const string = (f, at, gain, seconds = 2.4) => pluck(f, at, { gain, seconds, damping: 0.9985, tone: 3800, finger: true, dest: bus });
    const GLISS = [261.63, 329.63, 392, 493.88, 587.33, 659.25, 783.99, 987.77, 1174.66];
    GLISS.forEach((f, i) => string(f, t + i * 0.06 + rand(0, 0.008), 0.11 - i * 0.0035));
    const roll = t + GLISS.length * 0.06 + 0.1;
    [130.81, 261.63, 392, 493.88, 659.25, 987.77].forEach((f, i) => string(f, roll + i * 0.035, i === 0 ? 0.045 : 0.085, 2.6));
  },
  // "The Irish Washerwoman" (a traditional jig) on a low whistle, with the
  // quick cuts that make it sound Irish, over a bodhrán: DUM-da-da DUM-da-da.
  stpatricks(t) {
    const eighth = 0.16;
    const bus = withRoom(0.25);
    const G = 392, B = 493.88, C = 523.25, D = 587.33, lowD = 293.66;
    // d c | B G G D G G | B G B d c B | G
    const TUNE = [
      [D, 1], [C, 1],
      [B, 1], [G, 1], [G, 1, true], [lowD, 1], [G, 1], [G, 1, true],
      [B, 1], [G, 1], [B, 1], [D, 1], [C, 1], [B, 1],
      [G, 4],
    ];
    whistle(TUNE, t, eighth, 0.15, bus);
    for (let step = 2; step <= 14; step++) {
      const at = t + step * eighth;
      const strong = (step - 2) % 3 === 0;
      tone({ at, frequency: strong ? 120 : 170, endFrequency: strong ? 62 : 120, duration: strong ? 0.2 : 0.08, gain: strong ? 0.22 : 0.075, dest: bus });
      noiseBurst({ at, duration: 0.035, gain: strong ? 0.06 : 0.035, filterType: "lowpass", frequency: 1200, dest: bus });
    }
  },
  // Two blackbirds: one sings, and another answers from further off.
  spring(t) {
    const in_ = t - ctx.currentTime;
    clip("bird1", { gain: 0.3, delay: in_ });
    clip("bird2", { gain: 0.13, delay: in_ + 1.75 });
  },
  // Hawaiian ukulele: the island strum (down, down-up, up-down-up) through
  // C, F and G7 and home to C, in the ukulele's own G-C-E-A tuning.
  summer(t) {
    const C = [392, 261.63, 329.63, 523.25];
    const F = [440, 261.63, 349.23, 440];
    const G7 = [392, 293.66, 349.23, 493.88];
    const eighth = 0.13;
    const bus = withRoom(0.15);
    const hit = (chord, step, up = false, ring = 0.6) => {
      const strings = up ? [...chord].reverse().slice(0, 3) : chord; // upstrokes catch the high strings
      strings.forEach((f, i) =>
        pluck(f, t + step * eighth + i * (up ? 0.008 : 0.013) + rand(0, 0.004), {
          gain: up ? 0.06 : step % 8 === 0 ? 0.11 : 0.09,
          seconds: ring,
          damping: 0.995,
          tone: 5500,
          finger: true,
          bright: 1,
          dest: bus,
        })
      );
    };
    const PATTERN = [
      [C, 0], [C, 2], [C, 3, true], [C, 5, true], [C, 6], [C, 7, true],
      [F, 8], [F, 10], [F, 11, true],
      [G7, 12], [G7, 14], [G7, 15, true],
    ];
    for (const [chord, step, up] of PATTERN) hit(chord, step, up);
    hit(C, 16, false, 1.8);
  },
  // A crunch through dry leaves, a gust of wind, and a wistful fingerpicked
  // guitar falling like leaves: Am7, Fmaj7, landing on Cmaj7.
  autumn(t) {
    clip("leaves", { gain: 0.3, delay: t - ctx.currentTime });
    wind(t + 0.1, 3.2, 0.12);
    const eighth = 0.16;
    const bus = withRoom(0.25);
    const string = (f, step, gain = 0.13, seconds = 2) =>
      pluck(f, t + 0.3 + step * eighth + rand(0, 0.006), { gain, seconds, damping: 0.997, tone: 3200, finger: true, bright: 0.6, dest: bus });
    // bass, then down from the top of each chord
    [110, 392, 329.63, 261.63, 196].forEach((f, i) => string(f, i, i ? 0.13 : 0.17));
    [87.31, 329.63, 261.63, 220, 174.61].forEach((f, i) => string(f, 6 + i, i ? 0.13 : 0.17));
    // then settle: a slow roll up an open C chord, slowing like a leaf landing,
    // and two chiming harmonics (a guitarist's light touch at the 12th fret)
    [[130.81, 12], [196, 12.45], [293.66, 13], [329.63, 13.65], [392, 14.4]].forEach(([f, step], i) => string(f, step, i ? 0.11 : 0.15, 3));
    [659.25, 783.99].forEach((f, i) => {
      const at = t + 0.3 + (15.4 + i * 0.6) * eighth;
      tone({ at, frequency: f, duration: 2.6, gain: 0.05, attack: 0.004, dest: bus });
      tone({ at, frequency: f * 2, duration: 0.6, gain: 0.008, attack: 0.004, dest: bus });
    });
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
