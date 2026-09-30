export const fullName = (e) => [e?.firstName, e?.lastName].filter(Boolean).join(" ");

export const initials = (e) =>
  [e?.firstName?.[0], e?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "?";

export const plural = (n, word, pluralWord = `${word}s`) =>
  `${n} ${n === 1 ? word : pluralWord}`;

const longDate = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export const formatLongDate = (d) => longDate.format(new Date(d));
export const formatShortDate = (d) => shortDate.format(new Date(d));

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "today", "yesterday", "3 days ago", "2 weeks ago", "5 months ago", "2 years ago". */
export function relativeDate(d, now = Date.now()) {
  const days = Math.round((new Date(d).getTime() - now) / 86_400_000);
  const abs = Math.abs(days);
  if (abs < 7) return rtf.format(days, "day");
  if (abs < 30) return rtf.format(Math.round(days / 7), "week");
  if (abs < 365) return rtf.format(Math.round(days / 30.4), "month");
  return rtf.format(Math.round(days / 365), "year");
}

/** Stable, pleasant gradient for initials avatars — same name, same colour. */
export function avatarHue(seed = "") {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 360;
}
