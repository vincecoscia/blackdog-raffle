import { useState } from "react";
import { avatarHue, fullName, initials } from "@/lib/format";

/**
 * Photo avatar with a graceful initials fallback. Employee photos are arbitrary
 * URLs, so this is a plain <img> (any host works, no optimizer round-trip) that
 * swaps to a colour-hashed initials disc if the image is missing or 404s.
 */
export default function Avatar({ employee, size = 48, className = "", priority = false }) {
  const src = employee?.imageURL?.trim() || null;
  // Remember which URL failed, so a new URL gets a fresh chance to load.
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = src !== null && failedSrc === src;

  const name = fullName(employee) || "Teammate";
  const hue = avatarHue(name);
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`flex shrink-0 select-none items-center justify-center rounded-full font-display font-bold text-white ring-1 ring-white/10 ${className}`}
        style={{
          ...style,
          background: `linear-gradient(140deg, hsl(${hue} 55% 42%), hsl(${(hue + 40) % 360} 60% 28%))`,
        }}
      >
        {initials(employee)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(src)}
      className={`shrink-0 rounded-full object-cover ring-1 ring-white/10 ${className}`}
      style={style}
    />
  );
}
