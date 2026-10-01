import { useEffect, useRef, useState } from "react";
import { MAX_ENTRIES } from "@/lib/raffles";

const clampEntries = (n) => Math.min(MAX_ENTRIES, Math.max(0, n));

const Glyph = ({ d, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

/**
 * Monthly entries: − count +. The count can also be typed straight in, and
 * the arrow keys step it. Each change is reported at once; the caller decides
 * when to save.
 */
export default function EntryStepper({ value, onChange, label, size = "md" }) {
  const [draft, setDraft] = useState(null); // text while the count is being typed
  const input = useRef(null);
  const shown = useRef(value);
  const big = size === "lg";
  const active = value > 0;

  // Roll the number up or down a touch whenever it changes.
  useEffect(() => {
    const from = shown.current;
    shown.current = value;
    if (from === value || !input.current?.animate) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const dy = (value > from ? 1 : -1) * (big ? 9 : 6);
    input.current.animate(
      [
        { transform: `translateY(${dy}px)`, opacity: 0.15 },
        { transform: "translateY(0)", opacity: 1 },
      ],
      { duration: 240, easing: "cubic-bezier(.2,.9,.25,1.2)" }
    );
  }, [value, big]);

  const set = (n) => {
    const next = clampEntries(n);
    if (next !== value) onChange(next);
  };

  const commit = () => {
    if (draft === null) return;
    if (draft !== "") set(Number.parseInt(draft, 10));
    setDraft(null);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setDraft(null);
      set(value + (e.key === "ArrowUp" ? 1 : -1));
    } else if (e.key === "Enter") {
      commit();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setDraft(null);
      e.currentTarget.blur();
    }
  };

  const button = `flex shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-300 transition outline-none hover:bg-white/10 hover:text-ink-50 focus-visible:ring-2 focus-visible:ring-accent-400/60 active:scale-90 disabled:pointer-events-none disabled:opacity-25 ${
    big ? "size-9" : "size-7"
  }`;

  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`inline-flex items-center rounded-full border p-0.5 transition-colors duration-200 ${
          active ? "border-accent-400/40 bg-accent-400/10" : "border-white/10 bg-ink-800"
        }`}
      >
        <button type="button" className={button} onClick={() => set(value - 1)} disabled={value <= 0} aria-label={`One fewer entry for ${label}`}>
          <Glyph d="M6 12h12" size={big ? 16 : 13} />
        </button>
        <input
          ref={input}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-label={`Monthly entries for ${label}`}
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={MAX_ENTRIES}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, String(MAX_ENTRIES).length))}
          onFocus={(e) => e.target.select()}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className={`bg-transparent text-center font-display font-extrabold tabular-nums outline-none selection:bg-accent-400/30 ${
            active ? "text-accent-200" : "text-ink-400"
          } ${big ? "w-12 text-2xl" : "w-8 text-base"}`}
        />
        <button type="button" className={button} onClick={() => set(value + 1)} disabled={value >= MAX_ENTRIES} aria-label={`One more entry for ${label}`}>
          <Glyph d="M12 6v12M6 12h12" size={big ? 16 : 13} />
        </button>
      </span>
      <span className={`font-semibold whitespace-nowrap transition-colors ${big ? "text-base" : "text-xs"} ${active ? "text-accent-300" : "text-ink-500"}`}>
        {value === 1 ? "entry" : "entries"}
      </span>
    </span>
  );
}
