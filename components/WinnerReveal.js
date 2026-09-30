import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { useEffect } from "react";
import Avatar from "./Avatar";
import { SparklesIcon, TrophyIcon } from "./icons";
import { sparkle } from "@/lib/confetti";
import { formatLongDate, fullName } from "@/lib/format";

/** Full-screen winner announcement, shown once the reel has settled. */
export default function WinnerReveal({ result, onClose, onAgain }) {
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
          className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-gold-400/25 bg-ink-900 px-6 py-10 text-center shadow-[0_0_0_1px_rgb(247_201_72/.15),0_40px_120px_-20px_rgb(247_201_72/.35)] transition duration-500 ease-spring data-closed:scale-75 data-closed:opacity-0 sm:px-12 sm:py-14"
        >
          {/* Warm glow + a shine sweep across the card as it lands. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(247_201_72/.22),transparent_70%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 animate-shine bg-linear-to-r from-transparent via-white/10 to-transparent [animation-delay:.35s]"
          />

          {winner && (
            <div className="relative">
              <div className="winner-ring relative mx-auto h-36 w-36 animate-pop">
                <Avatar employee={winner} size={144} priority className="relative z-10 text-4xl" />
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
                <span className="font-semibold text-gold-300">{result.poolSize}</span> teammates who turned in their
                timesheets — a <span className="font-semibold text-gold-300">1 in {result.poolSize}</span> shot.
              </p>
              {result.raffle?.date && (
                <p className="mt-1 animate-fade-up text-xs text-ink-500 [animation-delay:.35s]">
                  {formatLongDate(result.raffle.date)}
                </p>
              )}

              <div className="mt-8 flex animate-fade-up flex-col-reverse gap-2 [animation-delay:.4s] sm:flex-row sm:justify-center">
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Done
                </button>
                <button type="button" className="btn btn-primary" onClick={onAgain}>
                  <SparklesIcon size={16} />
                  Draw again
                </button>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
