import { randomInt } from "node:crypto";
import mongoose from "mongoose";
import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import Raffle from "@/db/models/Raffle";

/** Make lean Mongo docs safe to hand to getServerSideProps / res.json. */
export const serialize = (value) => JSON.parse(JSON.stringify(value));

export const isValidId = (id) => mongoose.isValidObjectId(id);

const EDITABLE = ["firstName", "lastName", "email", "imageURL"];

/** Keep clients from writing arbitrary fields (e.g. `user`) into the document. */
export const pickEditable = (body = {}) =>
  Object.fromEntries(Object.entries(body).filter(([key]) => EDITABLE.includes(key)));

/**
 * Coerce an "in the draw" flag coming off the wire to the stored 0/1. Accepts
 * booleans as well as numbers so clients can send `{ inDraw: true }`.
 */
export function parseInDraw(value) {
  if (value === true || value === 1 || value === "1") return 1;
  if (value === false || value === 0 || value === "0") return 0;
  return null;
}

const byFirstName = (a, b) =>
  a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" }) ||
  a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" });

export async function getEmployees() {
  await connectDB();
  const employees = await Employee.find().lean();
  return serialize(employees.sort(byFirstName));
}

export async function getEmployeeWithWins(id) {
  if (!isValidId(id)) return null;
  await connectDB();
  const [employee, wins] = await Promise.all([
    Employee.findById(id).lean(),
    Raffle.find({ winner: id }).sort({ date: -1 }).lean(),
  ]);
  if (!employee) return null;
  return serialize({ employee, wins });
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
 * Draw a winner: everyone who is in the draw has exactly one entry. Runs on the
 * server with crypto-grade randomness and records the win in the same call, so
 * the client can never show a winner that wasn't saved (the bug in the old
 * version).
 */
export async function drawWinner({ drawnBy } = {}) {
  await connectDB();
  const pool = await Employee.find({ entries: { $gt: 0 } }).lean();
  if (pool.length === 0) {
    const err = new Error("Nobody is in the draw yet.");
    err.status = 409;
    throw err;
  }

  const winner = pool[randomInt(pool.length)];
  const raffle = await Raffle.create({ winner: winner._id, poolSize: pool.length, drawnBy });

  return serialize({ winner, raffle, poolSize: pool.length });
}
