/**
 * All raffle sounds are synthesised with the Web Audio API — no audio files to
 * download, and nothing plays until the user has clicked "Draw" (browsers
 * require a gesture before an AudioContext may start).
 */

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
    master.connect(ctx.destination);

    // Half a second of white noise, reused for every click and thump.
    noise = ctx.createBuffer(1, ctx.sampleRate / 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

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

function tone({ at, frequency, endFrequency, duration, gain, type = "sine", attack = 0.005 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, at);
  if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(env).connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

// --- preference store (usable with useSyncExternalStore) --------------------

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

/** Call from a click handler so the context exists before the reel starts. */
export function unlockAudio() {
  ensureContext();
}

/** Mechanical ratchet click. `speed` 0..1 — faster clicks are lighter and higher. */
export function playTick(speed = 0.5) {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime;
  noiseBurst({
    at: t,
    duration: 0.035,
    gain: 0.07 + 0.16 * (1 - speed),
    frequency: 1600 + 1400 * speed,
    q: 2.5,
  });
  tone({ at: t, frequency: 700 + 300 * speed, duration: 0.03, gain: 0.05 + 0.05 * (1 - speed), type: "square" });
}

/** Two quick sniffs. */
export function playSniff() {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime;
  for (const dt of [0, 0.11]) {
    noiseBurst({ at: t + dt, duration: 0.07, gain: 0.05, filterType: "highpass", frequency: 2600, q: 0.7 });
  }
}

/** Cymbal crash: a long, bright noise wash over a low thump. */
export function playCrash() {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 1.6, gain: 0.16, filterType: "highpass", frequency: 5200, q: 0.5 });
  noiseBurst({ at: t, duration: 0.7, gain: 0.1, filterType: "bandpass", frequency: 3200, q: 0.6 });
  tone({ at: t, frequency: 120, endFrequency: 55, duration: 0.3, gain: 0.35 });
}

/**
 * Snare drumroll that swells while it runs. Returns a stop function; pass
 * `true` to finish on a cymbal crash.
 */
export function startDrumroll() {
  if (!isSoundEnabled() || !ensureContext()) return () => {};
  const started = ctx.currentTime;
  let stopped = false;
  const hit = () => {
    if (!isSoundEnabled()) return; // muted mid-roll
    const t = ctx.currentTime;
    const swell = Math.min(1, (t - started) / 5);
    noiseBurst({
      at: t,
      duration: 0.07,
      gain: 0.025 + 0.075 * swell + Math.random() * 0.012,
      filterType: "bandpass",
      frequency: 1650 + Math.random() * 350,
      q: 0.9,
    });
    tone({ at: t, frequency: 185, duration: 0.05, gain: 0.015 + 0.03 * swell, type: "triangle" });
  };
  hit();
  const id = setInterval(hit, 47);
  return (crash = false) => {
    if (stopped) return;
    stopped = true;
    clearInterval(id);
    if (crash) playCrash();
  };
}

/** A paw scraping through a pile: a short, dry noise swipe. */
export function playScratch() {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime;
  noiseBurst({ at: t, duration: 0.09, gain: 0.09, filterType: "bandpass", frequency: 2200 + Math.random() * 900, q: 0.8 });
  noiseBurst({ at: t + 0.02, duration: 0.06, gain: 0.05, filterType: "lowpass", frequency: 700 });
}

/** The reel dropping into its detent. */
export function playThunk() {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime;
  tone({ at: t, frequency: 140, endFrequency: 50, duration: 0.22, gain: 0.5, type: "sine" });
  noiseBurst({ at: t, duration: 0.09, gain: 0.3, filterType: "lowpass", frequency: 500 });
}

/** Winner fanfare: a bright rising arpeggio and a shimmer on top. */
export function playFanfare() {
  if (!isSoundEnabled() || !ensureContext()) return;
  const t = ctx.currentTime + 0.05;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  notes.forEach((f, i) => {
    const at = t + i * 0.11;
    const last = i === notes.length - 1;
    tone({ at, frequency: f, duration: last ? 1.4 : 0.45, gain: 0.22, type: "triangle", attack: 0.01 });
    tone({ at, frequency: f * 2, duration: last ? 1.1 : 0.3, gain: 0.05, type: "sine", attack: 0.01 });
  });
  // Shimmer.
  tone({ at: t + 0.3, frequency: 2400, endFrequency: 4800, duration: 0.9, gain: 0.03, type: "sine", attack: 0.2 });
  noiseBurst({ at: t + 0.33, duration: 0.5, gain: 0.05, filterType: "highpass", frequency: 6000 });
}
