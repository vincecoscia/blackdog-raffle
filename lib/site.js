/** The site's name, and the public origin link previews point at (absolute URLs are required there). */
export const SITE_NAME = "Blackdog Raffle";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "https://www.blackdog-raffle.com" : "http://localhost:3000")
).replace(/\/$/, "");
