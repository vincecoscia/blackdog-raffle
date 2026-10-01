import { Radio, RadioGroup } from "@headlessui/react";
import { RAFFLE_KINDS } from "@/lib/raffles";

const LABELS = { weekly: "Weekly", monthly: "Monthly" };

/**
 * Weekly / monthly switch: a pill with a thumb that slides to the chosen
 * raffle. Arrow keys move between the two (it's a radio group underneath).
 */
export default function RaffleSwitch({ value, onChange, disabled = false, size = "md", className = "" }) {
  const index = Math.max(0, RAFFLE_KINDS.indexOf(value));
  const small = size === "sm";

  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      disabled={disabled}
      aria-label="Which raffle"
      className={`relative inline-grid grid-cols-2 rounded-full border border-white/8 bg-ink-950/70 p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/.4)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-linear-to-b from-accent-400/25 to-accent-400/10 ring-1 ring-accent-400/45 shadow-[0_6px_20px_-8px_rgb(119_221_175/.55),inset_0_1px_0_rgb(255_255_255/.1)] transition-transform duration-500 ease-spring"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {RAFFLE_KINDS.map((kind) => (
        <Radio
          key={kind}
          value={kind}
          className={`relative z-10 flex cursor-pointer items-center justify-center rounded-full font-display font-bold tracking-wide whitespace-nowrap text-ink-400 transition-colors duration-200 outline-none select-none data-hover:not-data-checked:text-ink-100 data-checked:text-accent-200 data-disabled:cursor-not-allowed data-disabled:opacity-60 data-focus:ring-2 data-focus:ring-accent-400/60 ${
            small ? "min-w-19 px-3 py-1 text-xs" : "min-w-26 px-4 py-2 text-sm"
          }`}
        >
          {LABELS[kind]}
        </Radio>
      ))}
    </RadioGroup>
  );
}
