import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Winner cards are served from a public URL (Google Chat's servers fetch the
 * image without signing in), so each URL carries an HMAC of the draw's id.
 * Only the app can mint one, and ids can't be guessed or enumerated.
 */
const secret = () => process.env.NEXTAUTH_SECRET ?? process.env.SECRET ?? "";

export function cardSignature(raffleId) {
  return createHmac("sha256", secret()).update(`card:${raffleId}`).digest("base64url").slice(0, 22);
}

export function isValidCardSignature(raffleId, signature) {
  if (typeof signature !== "string" || !secret()) return false;
  const expected = Buffer.from(cardSignature(raffleId));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Site-relative URL of a draw's winner card. */
export const cardPath = (raffleId) => `/api/card/${raffleId}?sig=${cardSignature(raffleId)}`;

/** This deployment's public origin, from the incoming request. */
export function originFrom(req) {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  const proto = req.headers["x-forwarded-proto"] ?? (/^(localhost|127\.)/.test(host ?? "") ? "http" : "https");
  return `${proto}://${host}`;
}
