import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import Avatar from "./Avatar";
import { CheckIcon, DownloadIcon, ShareIcon, SparklesIcon, Spinner, TrophyIcon } from "./icons";
import { api } from "@/lib/client";
import { sparkle } from "@/lib/confetti";
import { formatLongDate, fullName } from "@/lib/format";

const TILT_DEG = 7;

/**
 * Parallax tilt that follows the pointer. Writes CSS variables straight onto
 * the card, so it costs nothing in React and stays on the compositor.
 */
function tilt(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  el.style.setProperty("--rx", `${((x - 0.5) * 2 * TILT_DEG).toFixed(2)}deg`);
  el.style.setProperty("--ry", `${((0.5 - y) * 2 * TILT_DEG).toFixed(2)}deg`);
  el.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
  el.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
}

function untilt(e) {
  const el = e.currentTarget;
  el.style.setProperty("--rx", "0deg");
  el.style.setProperty("--ry", "0deg");
}

/** Full-screen winner announcement, shown once the reel has settled. */
/** Save the winner card, or post it to Google Chat (once per draw). */
function ShareActions({ result, chatEnabled }) {
  const [state, setState] = useState(result.raffle?.sharedAt ? "shared" : "idle"); // idle | sending | shared

  const share = async () => {
    setState("sending");
    try {
      await api(`/api/raffles/${result.raffle._id}/share`, { method: "POST" });
      setState("shared");
      toast.success("Posted to Google Chat.");
    } catch (err) {
      setState(err.status === 409 ? "shared" : "idle");
      toast.error(err.message);
    }
  };

  return (
    <div className="mt-5 flex animate-fade-up flex-wrap justify-center gap-2 [animation-delay:.35s]">
      <a href={`${result.cardUrl}&download=1`} download className="btn btn-ghost text-ink-300">
        <DownloadIcon size={15} />
        Save card
      </a>
      {chatEnabled && (
        <button type="button" onClick={share} disabled={state !== "idle"} className="btn btn-ghost text-ink-300">
          {state === "sending" ? <Spinner size={15} /> : state === "shared" ? <CheckIcon size={15} /> : <ShareIcon size={15} />}
          {state === "shared" ? "Posted to Google Chat" : "Share to Google Chat"}
        </button>
      )}
    </div>
  );
}

export default function WinnerReveal({ result, onClose, onAgain, chatEnabled = false }) {
  const open = Boolean(result);

  useEffect(() => {
    if (open) sparkle();
  }, [open]);

  const winner = result?.winner;
  const name = fullName(winner);

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-ink-950/80 backdrop-blur-md transition duration-300 data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-lg transition duration-500 ease-spring [perspective:1200px] data-closed:scale-75 data-closed:opacity-0"
        >
          <div
            onPointerMove={tilt}
            onPointerLeave={untilt}
            className="winner-card relative overflow-hidden rounded-[2rem] border border-accent-400/25 bg-ink-900 px-6 py-10 text-center shadow-[0_0_0_1px_rgb(119_221_175/.15),0_40px_120px_-20px_rgb(119_221_175/.35)] sm:px-12 sm:py-14"
          >
            {/* Glow + a shine sweep across the card as it lands. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(119_221_175/.22),transparent_70%)]"
            />
            {/* Pointer-following sheen (see --mx/--my). */}
            <div
              aria-hidden="true"
              className="winner-sheen pointer-events-none absolute inset-0"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-linear-to-r from-transparent via-white/10 to-transparent [animation-delay:.35s]"
            />

            {winner && (
              <div className="relative">
                <div className="winner-ring relative mx-auto h-36 w-36 animate-pop">
                  <Avatar
                    employee={winner}
                    size={144}
                    priority
                    className="relative z-10 text-4xl"
                  />
                </div>

                <p className="eyebrow mt-7 flex animate-fade-up items-center justify-center gap-2 [animation-delay:.15s]">
                  <TrophyIcon size={14} />
                  And the winner is
                  <TrophyIcon size={14} />
                </p>

                <DialogTitle
                  as="h2"
                  className="mt-2 animate-fade-up font-display text-4xl leading-[1.05] font-extrabold text-balance text-ink-50 [animation-delay:.2s] sm:text-6xl"
                >
                  {name}
                </DialogTitle>

                <p className="mt-4 animate-fade-up text-sm text-ink-300 [animation-delay:.3s]">
                  Congratulations, {winner.firstName}! Picked from{" "}
                  <span className="font-semibold text-accent-300">
                    {result.poolSize}
                  </span>{" "}
                  teammates who turned in their timesheets — a{" "}
                  <span className="font-semibold text-accent-300">
                    1 in {result.poolSize}
                  </span>{" "}
                  shot.
                </p>
                {result.raffle?.date && (
                  <p className="mt-1 animate-fade-up text-xs text-ink-500 [animation-delay:.35s]">
                    {formatLongDate(result.raffle.date)}
                  </p>
                )}

                {result.cardUrl && <ShareActions key={result.raffle._id} result={result} chatEnabled={chatEnabled} />}

                <div className="mt-6 flex animate-fade-up flex-col-reverse gap-2 [animation-delay:.4s] sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    Done
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onAgain}
                  >
                    <SparklesIcon size={16} />
                    Draw again
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
