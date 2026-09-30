import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import NameShuffle from "./NameShuffle";
import WinnerReveal from "./WinnerReveal";
import { SparklesIcon, Spinner, UsersIcon, VolumeIcon, VolumeOffIcon } from "./icons";
import { api } from "@/lib/client";
import { celebrate, preloadConfetti } from "@/lib/confetti";
import { plural } from "@/lib/format";
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

// three.js and the scene ship as their own chunk, fetched after hydration.
const BallMachine = dynamic(() => import("./BallMachine"), { ssr: false, loading: () => <MachineLoading /> });

// ---- renderer choice (decided once, on the client) --------------------------
let rendererChoice = null;
const noopSubscribe = () => () => {};
function detectRenderer() {
  if (rendererChoice) return rendererChoice;
  let gl = false;
  try {
    const c = document.createElement("canvas");
    gl = Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    gl = false;
  }
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  rendererChoice = gl && !reduced ? "gl" : "dom";
  return rendererChoice;
}

/**
 * The raffle: orchestrates the draw (server call, sound, confetti, reveal) and
 * hands the visual to the 3D ball machine, or to the name shuffle on browsers
 * without WebGL / for reduced-motion users.
 */
export default function RaffleSlotMachine({ employees, onWinner }) {
  const participants = useMemo(
    () =>
      employees
        .filter((e) => e.entries > 0)
        .map(({ _id, firstName, lastName, imageURL }) => ({ _id, firstName, lastName, imageURL })),
    [employees]
  );
  const renderer = useSyncExternalStore(noopSubscribe, detectRenderer, () => "pending");
  const soundOn = useSyncExternalStore(subscribeSound, isSoundEnabled, isSoundEnabledOnServer);

  const [phase, setPhase] = useState("idle"); // idle | drawing | spinning | landed
  const [machine, setMachine] = useState(null); // { draw, reset } from the 3D engine
  const [shuffle, setShuffle] = useState(null); // { key, winner } for the DOM fallback
  const [reveal, setReveal] = useState(null);

  const windowEl = useRef(null);
  const flashEl = useRef(null);
  const result = useRef(null);
  const onWinnerRef = useRef(onWinner);

  useEffect(() => {
    onWinnerRef.current = onWinner;
  }, [onWinner]);

  const players = participants.length;
  const busy = phase === "drawing" || phase === "spinning";

  /** Screen flash + a physical kick to the housing as the ball lands. */
  const landingFx = useCallback(() => {
    if (renderer !== "gl") return;
    flashEl.current?.animate([{ opacity: 0.5 }, { opacity: 0 }], { duration: 650, easing: "ease-out" });
    windowEl.current?.animate(
      [
        { transform: "translateY(0)" },
        { transform: "translateY(6px)", offset: 0.3 },
        { transform: "translateY(-2px)", offset: 0.65 },
        { transform: "translateY(0)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }, [renderer]);

  // Called by whichever visual is running, the moment the winner is presented.
  const landed = useCallback(() => {
    playThunk();
    landingFx();
    setTimeout(() => {
      celebrate();
      playFanfare();
    }, 180);
    setPhase("landed");
    onWinnerRef.current?.(result.current);
    setTimeout(() => setReveal(result.current), 900);
  }, [landingFx]);

  const clack = useCallback((speed) => playTick(0.35 + speed * 0.5), []);

  const draw = useCallback(async () => {
    if (busy || players === 0) return;
    unlockAudio();
    preloadConfetti();
    setShuffle(null);
    setPhase("drawing");

    try {
      ({ data: result.current } = await api("/api/raffle", { method: "POST" }));
    } catch (err) {
      toast.error(err.message);
      setPhase("idle");
      return;
    }

    setPhase("spinning");
    const { winner, raffle } = result.current;
    if (renderer === "gl" && machine) {
      machine.draw(winner);
    } else {
      setShuffle({ key: raffle._id, winner });
    }
  }, [busy, machine, players, renderer]);

  // After the reveal closes the winner stays in the cup until the next draw.
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
    drawing: "Shuffling the balls…",
    spinning: "Drawing…",
    landed: "Draw again",
  }[phase];

  const showShuffle = renderer === "dom" || (shuffle && phase !== "idle");

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

          {/* The machine window */}
          <div
            ref={windowEl}
            className="machine-window relative mt-5 h-[440px] overflow-hidden rounded-2xl bg-ink-950 ring-1 ring-white/6 sm:h-[520px]"
          >
            {players === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <SparklesIcon size={28} className="text-ink-600" />
                <p className="mt-3 font-display text-lg font-bold text-ink-300">The machine is empty</p>
                <p className="mt-1 text-sm text-ink-500">Flip teammates into the draw below to load it up.</p>
              </div>
            ) : (
              <>
                {renderer === "gl" && (
                  <BallMachine participants={participants} onReady={setMachine} onLanded={landed} onClack={clack} />
                )}
                {showShuffle && (
                  <div className="absolute inset-0 bg-ink-950">
                    <NameShuffle
                      key={shuffle?.key ?? "idle"}
                      participants={participants}
                      winner={shuffle?.winner ?? null}
                      reduced={renderer === "dom"}
                      onLanded={landed}
                      onTick={clack}
                    />
                  </div>
                )}
                <div aria-hidden="true" className="pointer-events-none absolute inset-0 shadow-[inset_0_0_70px_rgb(0_0_0/.75)]" />
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
                : "One ball each. Everyone in the draw has the same shot."}
            </p>
          </div>
        </div>
      </section>

      <WinnerReveal result={reveal} onClose={closeReveal} onAgain={drawAgain} />
    </>
  );
}

function MachineLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-500">
      <Spinner size={22} className="text-accent-400" />
      <p className="text-xs font-semibold tracking-wide uppercase">Warming up the machine</p>
    </div>
  );
}
