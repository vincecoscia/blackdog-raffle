import mongoose from "mongoose";

const RaffleSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  // How many teammates were in the hat for this draw — kept so history stays
  // meaningful after the roster is reset for the next week.
  poolSize: { type: Number },
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
