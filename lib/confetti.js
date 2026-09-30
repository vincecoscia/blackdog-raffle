/**
 * canvas-confetti, loaded on demand so it never touches the initial bundle, and
 * rendered from a web worker so a 600-particle celebration doesn't compete with
 * the reel animation for main-thread time.
 */

const GOLD = ["#ffd76a", "#f7c948", "#e8b52c", "#fff3c4", "#ffffff"];
const PARTY = ["#f7c948", "#ffffff", "#ff6b6b", "#4ecdc4", "#a78bfa", "#ffd76a"];

let confettiPromise = null;

function load() {
  if (!confettiPromise) {
    confettiPromise = import("canvas-confetti").then((mod) => {
      const confetti = mod.default;
      const canvas = document.createElement("canvas");
      canvas.className = "pointer-events-none fixed inset-0 z-[60] h-full w-full";
      canvas.setAttribute("aria-hidden", "true");
      document.body.appendChild(canvas);
      let fire;
      try {
        fire = confetti.create(canvas, { resize: true, useWorker: true });
      } catch {
        fire = confetti.create(canvas, { resize: true, useWorker: false });
      }
      return fire;
    });
  }
  return confettiPromise;
}

/** Warm the module while the reel is spinning so the burst is instant. */
export const preloadConfetti = () => {
  if (typeof window !== "undefined") load().catch(() => {});
};

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Side cannons + a gold shower when the reel lands. */
export async function celebrate() {
  const fire = await load();
  const scale = reduceMotion() ? 0.35 : 1;

  fire({
    particleCount: Math.round(140 * scale),
    angle: 60,
    spread: 70,
    startVelocity: 65,
    origin: { x: 0, y: 0.75 },
    colors: PARTY,
    ticks: 260,
    scalar: 1.1,
  });
  fire({
    particleCount: Math.round(140 * scale),
    angle: 120,
    spread: 70,
    startVelocity: 65,
    origin: { x: 1, y: 0.75 },
    colors: PARTY,
    ticks: 260,
    scalar: 1.1,
  });

  if (reduceMotion()) return;

  // A gentle gold rain for a couple of seconds after the bang.
  const end = Date.now() + 2200;
  const rain = () => {
    fire({
      particleCount: 6,
      angle: 90,
      spread: 160,
      startVelocity: 18,
      gravity: 0.8,
      drift: Math.random() - 0.5,
      origin: { x: Math.random(), y: -0.05 },
      colors: GOLD,
      ticks: 320,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(rain);
  };
  rain();
}

/** Small burst used when the winner card pops in. */
export async function sparkle() {
  const fire = await load();
  fire({
    particleCount: reduceMotion() ? 20 : 80,
    spread: 360,
    startVelocity: 30,
    gravity: 0.6,
    origin: { x: 0.5, y: 0.45 },
    colors: GOLD,
    shapes: ["star", "circle"],
    scalar: 1.2,
    ticks: 200,
  });
}
