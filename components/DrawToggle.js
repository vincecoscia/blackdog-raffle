import { Switch } from "@headlessui/react";
import { CheckIcon, Spinner } from "./icons";

/**
 * In-the-draw switch. One flip = one entry: on once a teammate's timesheet is
 * in, off if they're sitting this week out.
 */
export default function DrawToggle({ checked, onChange, saving = false, label = "In the draw", size = "md" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <Switch
        checked={checked}
        onChange={onChange}
        aria-label={label}
        className={`group relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-white/10 bg-ink-700 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-gold-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 data-checked:border-gold-400/60 data-checked:bg-gold-400 ${
          big ? "h-8 w-14" : "h-6 w-11"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-flex items-center justify-center rounded-full bg-ink-200 shadow-[0_1px_3px_rgb(0_0_0/.5)] transition-transform duration-200 ease-out group-data-checked:bg-ink-950 ${
            big ? "size-6 translate-x-1 group-data-checked:translate-x-7" : "size-4 translate-x-1 group-data-checked:translate-x-6"
          }`}
        >
          {saving ? (
            <Spinner size={big ? 14 : 10} className="text-gold-400" />
          ) : (
            <CheckIcon
              size={big ? 14 : 10}
              className="text-gold-300 opacity-0 transition-opacity group-data-checked:opacity-100"
            />
          )}
        </span>
      </Switch>
      <span
        className={`font-semibold whitespace-nowrap transition-colors ${big ? "text-base" : "text-xs"} ${
          checked ? "text-gold-300" : "text-ink-500"
        }`}
      >
        {checked ? "In the draw" : "Sitting out"}
      </span>
    </span>
  );
}
