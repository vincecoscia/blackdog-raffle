import mongoose from "mongoose";
import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import Raffle from "@/db/models/Raffle";
import { pickWeighted, pickWinner } from "@/lib/draw";
import { MAX_ENTRIES, ticketsFor } from "@/lib/raffles";

/** Make lean Mongo docs safe to hand to getServerSideProps / res.json. */
export const serialize = (value) => JSON.parse(JSON.stringify(value));

export const isValidId = (id) => mongoose.isValidObjectId(id);

const EDITABLE = ["firstName", "lastName", "email", "imageURL"];

/** Keep clients from writing arbitrary fields (e.g. `user`) into the document. */
export const pickEditable = (body = {}) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => EDITABLE.includes(key)));

/**
 * Coerce a weekly "in the draw" flag coming off the wire to a boolean.
 * Accepts 0/1 as well, as older clients sent.
 */
export function parseInDraw(value) {
  if (value === true || value === 1 || value === "1") return true;
  if (value === false || value === 0 || value === "0") return false;
  return null;
}

/** A monthly entry count off the wire, or null if it isn't a whole number in range. */
export function parseEntries(value) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return Number.isInteger(n) && n >= 0 && n <= MAX_ENTRIES ? n : null;
}

/**
 * Before the monthly draw, `entries` held the weekly in/out flag (0/1) and
 * there was no `inDraw`. Read such documents' flag from `entries` until
 * backfillInDraw() has given them a real one.
 */
export const withInDraw = (e) => (typeof e.inDraw === "boolean" ? e : { ...e, inDraw: e.entries > 0 });

let backfill = null;
/**
 * Copy the old weekly flag out of `entries` into `inDraw` for documents from
 * before the monthly draw. Runs once per server instance, before the first
 * write that touches `entries`, so a monthly count can never be misread as
 * the weekly flag. Plain reads never write.
 */
export function backfillInDraw() {
  backfill ??= (async () => {
    await connectDB();
    const legacy = { inDraw: { $exists: false } };
    await Employee.updateMany({ ...legacy, entries: { $gt: 0 } }, { $set: { inDraw: true } });
    await Employee.updateMany(legacy, { $set: { inDraw: false } });
  })().catch((err) => {
    backfill = null; // try again on the next write
    throw err;
  });
  return backfill;
}

const byFirstName = (a, b) =>
  a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" }) ||
  a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" });

export async function getEmployees() {
  await connectDB();
  const employees = await Employee.find().lean();
  return serialize(employees.map(withInDraw).sort(byFirstName));
}

export async function getEmployeeWithWins(id) {
  if (!isValidId(id)) return null;
  await connectDB();
  const [employee, wins] = await Promise.all([
    Employee.findById(id).lean(),
    Raffle.find({ winner: id }).sort({ date: -1 }).lean(),
  ]);
  if (!employee) return null;
  return serialize({ employee: withInDraw(employee), wins });
}

export async function getRecentWinners(limit = 8) {
  await connectDB();
  const raffles = await Raffle.find()
    .sort({ date: -1 })
    .limit(limit)
    .populate("winner", "firstName lastName imageURL")
    .lean();
  // A win whose employee was since deleted has a null winner; hide it.
  return serialize(raffles.filter((r) => r.winner));
}

export async function getWinCounts() {
  await connectDB();
  const rows = await Raffle.aggregate([{ $group: { _id: "$winner", wins: { $sum: 1 } } }]);
  return Object.fromEntries(rows.map((r) => [String(r._id), r.wins]));
}

/**
 * Draw a winner (see lib/draw.js and tests/fairness.test.js):
 * - weekly: everyone in the draw has exactly one entry and the same chance;
 * - monthly: every entry is a ticket, so chances follow entry counts.
 * Runs on the server and records the win in the same call, so the client can
 * never show a winner that wasn't saved.
 */
export async function drawWinner({ kind = "weekly", drawnBy, theme, timeZone } = {}) {
  await connectDB();
  const monthly = kind === "monthly";
  const candidates = await Employee.find(monthly ? { entries: { $gt: 0 } } : {}).lean();
  const pool = candidates.map(withInDraw).filter((e) => ticketsFor(e, kind) > 0);
  if (pool.length === 0) {
    const err = new Error(monthly ? "Nobody has any monthly entries yet." : "Nobody is in the draw yet.");
    err.status = 409;
    throw err;
  }

  const winner = monthly ? pickWeighted(pool, (e) => ticketsFor(e, kind)) : pickWinner(pool);
  const odds = monthly
    ? { entries: winner.entries, totalEntries: pool.reduce((sum, e) => sum + ticketsFor(e, kind), 0) }
    : {};
  const raffle = await Raffle.create({
    kind,
    winner: winner._id,
    poolSize: pool.length,
    ...odds,
    drawnBy,
    theme,
    timeZone,
  });

  return serialize({ winner, raffle, kind, poolSize: pool.length, ...odds });
}
