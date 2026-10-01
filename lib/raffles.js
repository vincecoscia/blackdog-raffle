import { plural } from "@/lib/format";

/**
 * The two raffles, shared by the server and the browser.
 *
 * - Weekly: everyone whose timesheet is in (`inDraw`) has one entry, so
 *   everyone in has the same chance.
 * - Monthly: each teammate's `entries` is how many tickets they hold in the
 *   hat, so 3 entries are three times the chance of 1.
 */
export const RAFFLE_KINDS = ["weekly", "monthly"];
export const DEFAULT_KIND = "weekly";
export const isRaffleKind = (value) => RAFFLE_KINDS.includes(value);

/** Remembers which raffle this browser was running, so reloads and "Back to the draw" land on it. */
export const KIND_COOKIE = "raffle-kind";

/** Most monthly entries one teammate can hold, so a typo can't swamp the hat. */
export const MAX_ENTRIES = 99;

/** How many tickets a teammate holds in a raffle. */
export const ticketsFor = (employee, kind) =>
  kind === "monthly" ? Math.max(0, Math.trunc(employee?.entries ?? 0)) : employee?.inDraw ? 1 : 0;

/** How many people are in a raffle, and how many tickets they hold between them. */
export function tally(employees, kind) {
  let people = 0;
  let tickets = 0;
  for (const e of employees) {
    const t = ticketsFor(e, kind);
    if (t > 0) {
      people += 1;
      tickets += t;
    }
  }
  return { people, tickets };
}

/** A chance as a friendly percentage: "38%", "4.2%", "<0.1%". */
export function formatChance(tickets, total) {
  if (!tickets || !total) return "0%";
  const pct = (tickets / total) * 100;
  if (pct >= 99.95) return "100%";
  if (pct < 0.1) return "<0.1%";
  return `${pct >= 10 ? Math.round(pct) : pct.toFixed(1).replace(/\.0$/, "")}%`;
}

/** What a recorded draw was picked from: "142 entries" or "28 teammates". */
export function drawnFrom(raffle) {
  if (raffle?.kind === "monthly" && raffle.totalEntries) return plural(raffle.totalEntries, "entry", "entries");
  return raffle?.poolSize ? plural(raffle.poolSize, "teammate") : null;
}
