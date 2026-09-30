import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { toast } from "react-toastify";
import Avatar from "./Avatar";
import WinnerReveal from "./WinnerReveal";
import { SparklesIcon, Spinner, UsersIcon, VolumeIcon, VolumeOffIcon } from "./icons";
import { api } from "@/lib/client";
import { celebrate, preloadConfetti } from "@/lib/confetti";
import { fullName, plural } from "@/lib/format";
import { DETENT_DURATION, buildStrip, detent, findLanding, planMotion } from "@/lib/reel";
import {
  isSoundEnabled,
  isSoundEnabledOnServer,
  playFanfare,
  playThunk,
  playTick,
  setSoundEnabled,
  subscribeSound,
  unlockAudio,
} from "@/lib/sound";

// ---- drum geometry ----------------------------------------------------------
// Rows are laid out around a cylinder: SLOTS rows per revolution, so each row
// sits STEP degrees from the next at RADIUS px from the axis. Spinning the reel
// is then a single rotateX on the drum; the rows themselves never move.
export const ROW_H = 76; // px per row (drives the radius)
const SLOTS = 16;
const STEP = 360 / SLOTS; // 22.5°
const RADIUS = Math.round(ROW_H / 2 / Math.tan(Math.PI / SLOTS)); // ≈191px
const ARC = 4; // rows kept visible each side of the payline (±90°)
const WINDOW_H = 380;
const IDLE_SPEED = 14; // px/s slow drift while nothing is happening
const MIN_TRAVEL_ROWS = 80;
const MIN_TRAVEL_ROWS_REDUCED = 6;

const angleFor = (p) => (p / ROW_H) * STEP;

// The reel idles a whole number of cycles into the strip so there are always
// ARC rows above the payline as well as below it.
const baseCycles = (len) => Math.max(1, Math.ceil(ARC / len));
const basePos = (len) => baseCycles(len) * len * ROW_H;
const minRepeats = (len) => (len ? baseCycles(len) + 1 + Math.ceil((ARC + 2) / len) : 0);
const wrap = (p, len) => {
  const cycle = len * ROW_H;
  const base = basePos(len);
  return cycle ? base + ((((p - base) % cycle) + cycle) % cycle) : p;
};

/**
 * The raffle reel: a 3D drum of names. The draw itself happens on the server,
 * and the drum is animated to land on whoever the server picked. Per frame the
 * only DOM write is the drum's rotation (compositor-only); rows outside the
 * front arc are hidden and swapped in one at a time as the drum turns.
 */
export default function RaffleSlotMachine({ employees, onWinner }) {
  const strip = useMemo(() => buildStrip(employees), [employees]);
  const [phase, setPhase] = useState("idle"); // idle | drawing | spinning | landed
  // While a draw is in flight the reel keeps the strip it started with, even if
  // the roster changes underneath it; at rest it always reflects the roster.
  const [frozen, setFrozen] = useState(null); // { strip, repeats }
  const [landedIdx, setLandedIdx] = useState(-1);
  const [reveal, setReveal] = useState(null);
  const soundOn = useSyncExternalStore(subscribeSound, isSoundEnabled, isSoundEnabledOnServer);

  const drumEl = useRef(null);
  const windowEl = useRef(null);
  const flashEl = useRef(null);
  const pos = useRef(basePos(strip.length)); // px along the (conceptually infinite) strip
  const phaseRef = useRef("idle");
  const motion = useRef(null);
  const raf = useRef(0);
  const lastRow = useRef(0);
  const lastTs = useRef(0);
  const reduced = useRef(false);
  const onWinnerRef = useRef(onWinner);

  const players = employees.filter((e) => e.entries > 0).length;
  const busy = phase === "drawing" || phase === "spinning";
  const activeStrip = phase === "idle" || !frozen ? strip : frozen.strip;
  const repeats = phase === "idle" || !frozen ? minRepeats(strip.length) : frozen.repeats;
  const L = activeStrip.length;

  useEffect(() => {
    onWinnerRef.current = onWinner;
  }, [onWinner]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => (reduced.current = mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const render = useCallback(() => {
    if (drumEl.current) {
      drumEl.current.style.transform = `translateZ(${-RADIUS}px) rotateX(${angleFor(pos.current).toFixed(3)}deg)`;
    }
  }, []);

  /**
   * Only rows within ARC of the payline are shown; everything else is hidden so
   * rows sharing a slot angle never overlap. `full` re-scans every row (after
   * the list changes or the position jumps); otherwise only the edge moves.
   */
  const syncVisibility = useCallback((center, full = false) => {
    if (!drumEl.current) return;
    const count = drumEl.current.childElementCount;
    const from = full ? 0 : Math.max(0, center - ARC - 2);
    const to = full ? count - 1 : Math.min(count - 1, center + ARC + 2);
    for (let i = from; i <= to; i++) {
      drumEl.current.children[i].style.visibility = Math.abs(i - center) <= ARC ? "visible" : "";
    }
  }, []);

  /** The strip is periodic, so we can always wrap back into the idle cycle. */
  const rebase = useCallback(
    (len) => {
      pos.current = wrap(pos.current, len);
      lastRow.current = Math.round(pos.current / ROW_H);
      render();
      syncVisibility(lastRow.current, true);
    },
    [render, syncVisibility]
  );

  const rows = useMemo(() => {
    const out = [];
    for (let r = 0; r < repeats; r++) {
      for (let i = 0; i < activeStrip.length; i++) {
        out.push({ index: r * activeStrip.length + i, employee: activeStrip[i] });
      }
    }
    return out;
  }, [activeStrip, repeats]);

  // Whenever the row list changes, re-establish which rows are on the front arc.
  useLayoutEffect(() => {
    syncVisibility(Math.round(pos.current / ROW_H), true);
  }, [rows, syncVisibility]);

  const setSpeedFx = useCallback((velocity, vmax) => {
    const s = vmax ? Math.min(1, velocity / vmax) : 0;
    windowEl.current?.style.setProperty("--speed", s.toFixed(2));
  }, []);

  /** Screen flash + a physical kick to the housing as the reel hits its stop. */
  const landingFx = useCallback(() => {
    if (reduced.current) return;
    flashEl.current?.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 650, easing: "ease-out" });
    windowEl.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(7px)", offset: 0.3 },
        { transform: "translateY(-3px)", offset: 0.65 },
        { transform: "translateY(0)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }, []);

  // ---- the animation loop -------------------------------------------------
  useEffect(() => {
    const frame = (ts) => {
      raf.current = requestAnimationFrame(frame);
      const dt = lastTs.current ? Math.min(0.05, (ts - lastTs.current) / 1000) : 0;
      lastTs.current = ts;
      const m = motion.current;
      let velocity = 0;

      if (m) {
        const t = (ts - m.startedAt) / 1000;

        if (t < m.plan.duration) {
          pos.current = m.startPos + m.plan.positionAt(t);
          velocity = m.plan.velocityAt(t);
        } else {
          const settle = t - m.plan.duration;
          if (!m.hit) {
            m.hit = true;
            playThunk();
            landingFx();
            setTimeout(() => {
              celebrate();
              playFanfare();
            }, 180);
          }
          pos.current = m.targetPos + detent(settle, m.plan.vend);

          if (settle >= DETENT_DURATION) {
            pos.current = m.targetPos;
            motion.current = null;
            phaseRef.current = "landed";
            setPhase("landed");
            onWinnerRef.current?.(m.result);
            setTimeout(() => setReveal(m.result), 350);
          }
        }
        setSpeedFx(velocity, m.plan.vmax);
      } else if (phaseRef.current === "idle" && L > 0) {
        if (!reduced.current) pos.current += IDLE_SPEED * dt;
        pos.current = wrap(pos.current, L);
      }

      const row = Math.round(pos.current / ROW_H);
      if (row !== lastRow.current) {
        lastRow.current = row;
        syncVisibility(row);
        if (m) playTick(Math.min(1, velocity / m.plan.vmax));
      }

      render();
    };
    raf.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf.current);
  }, [L, landingFx, render, setSpeedFx, syncVisibility]);

  // ---- drawing --------------------------------------------------------------
  const draw = useCallback(async () => {
    if (busy || players === 0) return;
    unlockAudio();
    preloadConfetti();
    phaseRef.current = "drawing";
    setFrozen({ strip: activeStrip, repeats });
    setPhase("drawing");
    setLandedIdx(-1);

    let result;
    try {
      ({ data: result } = await api("/api/raffle", { method: "POST" }));
    } catch (err) {
      toast.error(err.message);
      phaseRef.current = "idle";
      setPhase("idle");
      return;
    }

    // Spin the *current* roster (someone may have been flipped in since the
    // last draw), and make sure the winner is on the reel whatever happened.
    const winnerId = result.winner._id;
    let stripNow = strip;
    if (!stripNow.some((e) => e._id === winnerId)) stripNow = [...stripNow, result.winner];
    const len = stripNow.length;
    const isReduced = reduced.current;

    rebase(len);
    const fromIdx = Math.ceil(pos.current / ROW_H);
    const landingIdx = findLanding(stripNow, winnerId, fromIdx, isReduced ? MIN_TRAVEL_ROWS_REDUCED : MIN_TRAVEL_ROWS);
    const targetPos = landingIdx * ROW_H;

    // Commit enough rows synchronously so the DOM exists before the first frame.
    flushSync(() => {
      setFrozen({ strip: stripNow, repeats: Math.ceil((landingIdx + ARC + 2) / len) });
      setLandedIdx(landingIdx);
    });
    rebase(len);

    const plan = planMotion({
      distance: targetPos - pos.current,
      v0: isReduced ? 0 : IDLE_SPEED,
      reduced: isReduced,
    });
    motion.current = { plan, startPos: pos.current, targetPos, startedAt: performance.now(), result, hit: false };
    phaseRef.current = "spinning";
    setPhase("spinning");
  }, [activeStrip, busy, players, rebase, repeats, strip]);

  // After the reveal closes the reel stays parked on the winner (no idle
  // drift) until the next draw.
  const closeReveal = () => setReveal(null);

  const drawAgain = () => {
    setReveal(null);
    setTimeout(draw, 60);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) {
      unlockAudio();
      playTick(0.2);
    }
  };

  const buttonLabel = {
    idle: "Draw a winner",
    drawing: "Shuffling tickets…",
    spinning: "Drawing…",
    landed: "Draw again",
  }[phase];

  return (
    <>
      <section aria-label="Raffle" className="accent-frame animate-fade-up p-1">
        <div className="rounded-[1.4rem] bg-ink-900/90 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow pt-2.5">Blackdog weekly draw</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="chip">
                  <UsersIcon size={13} className="text-accent-400" />
                  {plural(players, "teammate")} in the draw
                </span>
                {players > 0 && <span className="chip text-ink-400">1 in {players} chance each</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              aria-label={soundOn ? "Mute sound effects" : "Unmute sound effects"}
              title={soundOn ? "Sound on" : "Sound off"}
              className={`btn btn-icon ${soundOn ? "btn-secondary text-accent-300" : "btn-ghost text-ink-500"}`}
            >
              {soundOn ? <VolumeIcon size={18} /> : <VolumeOffIcon size={18} />}
            </button>
          </div>

          {/* The window onto the drum */}
          <div
            ref={windowEl}
            className="reel-window relative mt-5 overflow-hidden rounded-2xl bg-ink-950 ring-1 ring-white/6 [--speed:0]"
            style={{ height: WINDOW_H }}
          >
            {L === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <SparklesIcon size={28} className="text-ink-600" />
                <p className="mt-3 font-display text-lg font-bold text-ink-300">The hat is empty</p>
                <p className="mt-1 text-sm text-ink-500">Flip teammates into the draw below to get the reel spinning.</p>
              </div>
            ) : (
              <ul
                ref={drumEl}
                className="reel-drum m-0 list-none p-0"
                style={{ transform: `translateZ(${-RADIUS}px) rotateX(${angleFor(basePos(L)).toFixed(3)}deg)` }}
              >
                {rows.map(({ index, employee }) => (
                  <li
                    key={index}
                    data-landed={index === landedIdx && phase === "landed" ? "" : undefined}
                    className="reel-row flex items-center gap-4 px-5 sm:px-8"
                    style={{
                      height: ROW_H,
                      marginTop: -ROW_H / 2,
                      transform: `rotateX(${-index * STEP}deg) translateZ(${RADIUS}px)`,
                    }}
                  >
                    <Avatar employee={employee} size={44} priority className="reel-avatar" />
                    <span className="truncate font-display text-xl font-bold sm:text-2xl">{fullName(employee)}</span>
                  </li>
                ))}
              </ul>
            )}

            {L > 0 && (
              <>
                {/* Cylinder shading + a glass highlight across the drum. */}
                <div aria-hidden="true" className="reel-shade pointer-events-none absolute inset-0" />
                <div aria-hidden="true" className="reel-gloss pointer-events-none absolute inset-0" />
                {/* Payline: glows brighter the faster the reel spins (see --speed). */}
                <div
                  aria-hidden="true"
                  className="reel-payline pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-accent-400/35 bg-accent-400/4"
                  style={{ height: ROW_H }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-0 -translate-y-1/2 border-y-9 border-l-12 border-y-transparent border-l-accent-400 drop-shadow-[0_0_8px_rgb(119_221_175/.8)]"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-0 -translate-y-1/2 border-y-9 border-r-12 border-y-transparent border-r-accent-400 drop-shadow-[0_0_8px_rgb(119_221_175/.8)]"
                />
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_60px_rgb(0_0_0/.75)]" />
                {/* Landing flash (driven by the Web Animations API). */}
                <div ref={flashEl} aria-hidden="true" className="pointer-events-none absolute inset-0 bg-accent-200 opacity-0" />
              </>
            )}
          </div>

          <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={draw}
              disabled={busy || players === 0}
              className={`btn btn-primary h-13 flex-1 text-base sm:max-w-xs ${
                phase === "idle" && players > 0 ? "animate-pulse-glow" : ""
              }`}
            >
              {phase === "drawing" ? <Spinner size={18} /> : <SparklesIcon size={18} />}
              {buttonLabel}
            </button>
            <p className="text-sm text-ink-400 sm:ml-2" aria-live="polite">
              {players === 0
                ? "Nobody's in the draw yet — flip teammates in below."
                : "One entry each. Everyone in the draw has the same shot."}
            </p>
          </div>
        </div>
      </section>

      <WinnerReveal result={reveal} onClose={closeReveal} onAgain={drawAgain} />
    </>
  );
}
