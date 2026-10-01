import mongoose from "mongoose";
import { RAFFLE_KINDS } from "@/lib/raffles";

const RaffleSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  // "weekly" (one entry per timesheet) or "monthly" (weighted by entries).
  // Draws from before the monthly raffle have none; they were all weekly.
  kind: { type: String, enum: RAFFLE_KINDS },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  // How many teammates were in the hat for this draw — kept so history stays
  // meaningful after the roster is reset for the next week.
  poolSize: { type: Number },
  // Monthly draws: the winner's entries and how many entries were in the hat.
  entries: { type: Number },
  totalEntries: { type: Number },
  drawnBy: { type: String },
  // The seasonal skin that was on screen (null = brand look) and the drawer's
  // time zone, so the winner card matches what people saw.
  theme: { type: String, default: undefined },
  timeZone: { type: String },
  // Set once the winner card has been posted to Google Chat.
  sharedAt: { type: Date },
  sharedBy: { type: String },
});

export default mongoose.models.Raffle || mongoose.model("Raffle", RaffleSchema);
