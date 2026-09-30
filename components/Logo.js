import { LOGO_PATHS, LOGO_VARIANTS } from "@/lib/brand";

/**
 * The BlackDog logo, drawn in currentColor (so `text-*` classes tint it). Size
 * it by height, e.g. `className="h-10 w-auto"`. `variant` is "lockup" (dog +
 * wordmark), "mark" (dog) or "wordmark"; `registered={false}` hides the ® at
 * sizes where it would be a speck. Pass `label=""` when a neighbour already
 * names it, to hide it from screen readers.
 */
export default function Logo({ variant = "lockup", registered = true, label = "BlackDog", className = "" }) {
  const v = LOGO_VARIANTS[variant];
  const [, , width, height] = v.viewBox;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={v.viewBox.join(" ")}
      width={width}
      height={height}
      fill="currentColor"
      fillRule="evenodd"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : "true"}
      className={className}
    >
      {v.dog && <path d={LOGO_PATHS.dog} />}
      {v.dog && registered && <path d={LOGO_PATHS.registered} />}
      {v.wordmark && <path d={LOGO_PATHS.wordmark} />}
    </svg>
  );
}
