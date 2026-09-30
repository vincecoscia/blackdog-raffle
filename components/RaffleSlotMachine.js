import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import NameShuffle from "./NameShuffle";
import WinnerReveal from "./WinnerReveal";
import { ExpandIcon, ShrinkIcon, SparklesIcon, Spinner, UsersIcon, VolumeIcon, VolumeOffIcon } from "./icons";
import { api } from "@/lib/client";
import { celebrate, preloadConfetti } from "@/lib/confetti";
import { plural } from "@/lib/format";
import {
  isSoundEnabled,
  isSoundEnabledOnServer,
  playThunk,
  playTick,
  playWinnerSting,
  prefetchSounds,
  setSoundEnabled,
  sfx,
  startSuspense,
  subscribeSound,
  unlockAudio,
} from "@/lib/sound";

// The animated scene ships as its own chunk, fetched after hydration.
const DogFetch = dynamic(() => import("./DogFetch"), { ssr: false, loading: () => <SceneLoading /> });

// ---- renderer choice (decided once, on the client) --------------------------
let rendererChoice = null;
const noopSubscribe = () => () => {};
function detectRenderer() {
  if (!rendererChoice) {
    rendererChoice = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "dom" : "scene";
  }
  return rendererChoice;
}

/** Keys typed into controls shouldn't trigger the big-screen shortcuts. */
const isFromControl = (e) =>
  e.target instanceof Element && Boolean(e.target.closest("button, a, input, textarea, select, [contenteditable]"));

/**
 * The raffle: orchestrates the draw (server call, sound, confetti, reveal) and
 * hands the visual to the dog-fetches-a-bone scene, or to a simple name
 * shuffle for users who prefer reduced motion. "Big screen" mode turns the
 * stage into a full-screen presentation for drawing live in a meeting.
 */
export default function RaffleSlotMachine({ employees, onWinner, chatEnabled = false }) {
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
  const [scene, setScene] = useState(null); // { draw, reset } from the scene engine
  const [shuffle, setShuffle] = useState(null); // { key, winner } for the DOM fallback
  const [reveal, setReveal] = useState(null);
  const [big, setBig] = useState(false);

  const windowEl = useRef(null);
  const flashEl = useRef(null);
  const result = useRef(null);
  const stopRoll = useRef(null);
  const onWinnerRef = useRef(onWinner);
  const shortcut = useRef(null);

  useEffect(() => {
    onWinnerRef.current = onWinner;
  }, [onWinner]);

  // Never leave suspense music running if the component goes away mid-draw.
  useEffect(() => () => stopRoll.current?.(false), []);

  // Fetch the recorded sounds once the page has settled, so the first bark is instant.
  useEffect(() => {
    if (!isSoundEnabled()) return;
    const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
    const cancel = window.cancelIdleCallback ?? clearTimeout;
    const id = idle(() => prefetchSounds());
    return () => cancel(id);
  }, []);

  const players = participants.length;
  const busy = phase === "drawing" || phase === "spinning";

  /** Screen flash + a little kick to the frame as the bone is revealed. */
  const landingFx = useCallback(() => {
    if (renderer !== "scene") return;
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

  // The scene calls this when the search starts (suspense music until the
  // reveal), and with "climax" for the last second before the bone is flipped.
  const suspense = useCallback((state) => {
    if (state === "climax") return stopRoll.current?.climax();
    stopRoll.current?.(false);
    stopRoll.current = state ? startSuspense() : null;
  }, []);

  // Called by whichever visual is running, the moment the winner is revealed
  // (with the seasonal skin that's showing, if any).
  const landed = useCallback((theme = null) => {
    if (stopRoll.current) {
      stopRoll.current(true); // end the suspense on its reveal hit
      stopRoll.current = null;
    } else {
      playThunk();
    }
    landingFx();
    if (renderer === "scene") sfx.happyBarks(0.12);
    setTimeout(() => {
      celebrate();
      playWinnerSting(theme);
    }, 180);
    if (renderer === "scene") setTimeout(() => sfx.pant(), 1900);
    setPhase("landed");
    onWinnerRef.current?.(result.current);
    setTimeout(() => setReveal(result.current), 900);
  }, [landingFx, renderer]);

  const clack = useCallback((speed) => playTick(0.35 + speed * 0.5), []);

  const draw = useCallback(async () => {
    if (busy || players === 0) return;
    unlockAudio();
    preloadConfetti();
    setShuffle(null);
    setPhase("drawing");

    try {
      ({ data: result.current } = await api("/api/raffle", {
        method: "POST",
        body: {
          theme: scene?.theme ?? null, // so the winner card wears the same skin
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      }));
    } catch (err) {
      toast.error(err.message);
      setPhase("idle");
      return;
    }

    setPhase("spinning");
    const { winner, raffle } = result.current;
    if (renderer === "scene" && scene) {
      scene.draw(winner);
    } else {
      setShuffle({ key: raffle._id, winner });
    }
  }, [busy, scene, players, renderer]);

  // After the reveal closes, the dog keeps showing off the bone until the next draw.
  const closeReveal = () => setReveal(null);
  const drawAgain = useCallback(() => {
    setReveal(null);
    setTimeout(draw, 60);
  }, [draw]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    if (next) {
      unlockAudio();
      playTick(0.2);
    }
  };

  // ---- big screen ------------------------------------------------------------
  const enterBig = () => {
    setBig(true);
    document.documentElement.requestFullscreen?.().catch(() => {
      /* not allowed (e.g. iOS): the overlay still fills the window */
    });
  };
  const exitBig = useCallback(() => {
    setBig(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    shortcut.current = reveal ? drawAgain : draw;
  }, [reveal, draw, drawAgain]);

  useEffect(() => {
    if (!big) return;
    const onFullscreen = () => {
      if (!document.fullscreenElement) setBig(false);
    };
    const onKey = (e) => {
      if (e.defaultPrevented) return;
      // Esc always leaves big screen (the reveal dialog handles its own Esc).
      if (e.key === "Escape") {
        if (!reveal) exitBig();
        return;
      }
      if (isFromControl(e)) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        shortcut.current?.();
      }
    };
    document.addEventListener("fullscreenchange", onFullscreen);
    window.addEventListener("keydown", onKey);
    document.documentElement.classList.add("big-screen");
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("big-screen");
    };
  }, [big, reveal, exitBig]);

  const buttonLabel = {
    idle: "Draw a winner",
    drawing: "Shuffling the bones…",
    spinning: "Fetching…",
    landed: "Draw again",
  }[phase];

  const showShuffle = renderer === "dom" || (shuffle && phase !== "idle");

  return (
    <>
      <section
        aria-label="Raffle"
        className={big ? "fixed inset-0 z-45 flex flex-col bg-ink-950 p-3 sm:p-6" : "accent-frame animate-fade-up p-1"}
      >
        <div className={big ? "flex min-h-0 flex-1 flex-col" : "rounded-[1.4rem] bg-ink-900/90 p-4 sm:p-6"}>
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
            <div className="flex gap-2">
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
              {renderer === "scene" && (
                <button
                  type="button"
                  onClick={big ? exitBig : enterBig}
                  aria-pressed={big}
                  aria-label={big ? "Exit big screen" : "Big screen"}
                  title={big ? "Exit big screen (Esc)" : "Big screen — for drawing live"}
                  className="btn btn-icon btn-secondary"
                >
                  {big ? <ShrinkIcon size={18} /> : <ExpandIcon size={18} />}
                </button>
              )}
            </div>
          </div>

          {/* The stage */}
          <div
            ref={windowEl}
            className={`stage-window relative mt-5 overflow-hidden rounded-2xl bg-ink-950 ring-1 ring-white/6 ${
              big ? "min-h-0 flex-1" : "h-120 sm:h-140"
            }`}
          >
            {players === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <SparklesIcon size={28} className="text-ink-600" />
                <p className="mt-3 font-display text-lg font-bold text-ink-300">No bones in the pile</p>
                <p className="mt-1 text-sm text-ink-500">Flip teammates into the draw below to fill it up.</p>
              </div>
            ) : (
              <>
                {renderer === "scene" && (
                  <DogFetch
                    participants={participants}
                    covered={Boolean(reveal)}
                    onReady={setScene}
                    onLanded={landed}
                    onSuspense={suspense}
                  />
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

          <div
            className={`mt-5 flex flex-col items-stretch gap-3 ${
              big ? "sm:flex-row sm:items-center sm:justify-center" : "sm:flex-row sm:items-center"
            }`}
          >
            <button
              type="button"
              onClick={draw}
              disabled={busy || players === 0}
              className={`btn btn-primary flex-1 ${big ? "h-14 text-lg sm:max-w-sm" : "h-13 text-base sm:max-w-xs"} ${
                phase === "idle" && players > 0 ? "pulse-glow" : ""
              }`}
            >
              {phase === "drawing" ? <Spinner size={18} /> : <SparklesIcon size={18} />}
              {buttonLabel}
            </button>
            <p className="text-sm text-ink-400 sm:ml-2" aria-live="polite">
              {players === 0
                ? "Nobody's in the draw yet — flip teammates in below."
                : big
                  ? "Press Space to draw · Esc to exit"
                  : (
                    <>
                      One bone each, same shot for everyone.{" "}
                      <Link href="/fairness" className="font-semibold text-accent-300 hover:text-accent-200">
                        How the draw works
                      </Link>
                    </>
                  )}
            </p>
          </div>
        </div>
      </section>

      <WinnerReveal result={reveal} onClose={closeReveal} onAgain={drawAgain} chatEnabled={chatEnabled} />
    </>
  );
}

function SceneLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-ink-500">
      <Spinner size={22} className="text-accent-400" />
      <p className="text-xs font-semibold tracking-wide uppercase">Waking up the dog</p>
    </div>
  );
}
