import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { fullName } from "@/lib/format";

/**
 * Fallback for browsers without WebGL and for users who prefer reduced
 * motion: names flicker through the pool, slow down and stop on the winner.
 * The parent remounts it (via `key`) for every draw.
 */
export default function NameShuffle({ participants, winner, caption = null, reduced = false, onLanded, onTick }) {
  const [shown, setShown] = useState(null);

  useEffect(() => {
    if (!winner) return;
    let timer;
    const finish = () => {
      setShown(winner);
      onLanded?.();
    };

    if (reduced || participants.length < 2) {
      timer = setTimeout(finish, 900);
      return () => clearTimeout(timer);
    }

    const start = performance.now();
    const total = 2600;
    const others = participants.filter((p) => p._id !== winner._id);
    const flick = () => {
      const t = (performance.now() - start) / total;
      if (t >= 1) return finish();
      setShown(others[Math.floor(Math.random() * others.length)]);
      onTick?.(1 - t);
      timer = setTimeout(flick, 60 + 320 * t * t);
    };
    flick();
    return () => clearTimeout(timer);
  }, [winner, participants, reduced, onLanded, onTick]);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      {shown ? (
        <>
          <Avatar employee={shown} size={72} priority />
          <p
            className={`mt-4 font-display text-3xl font-extrabold sm:text-4xl ${
              shown._id === winner?._id ? "text-accent-300" : "text-ink-50"
            }`}
          >
            {fullName(shown)}
          </p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl font-extrabold text-ink-200">Ready to draw</p>
          <p className="mt-1 text-sm text-ink-500">
            {caption ?? `${participants.length} ${participants.length === 1 ? "name" : "names"} in the hat`}
          </p>
        </>
      )}
    </div>
  );
}
