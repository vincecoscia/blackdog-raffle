import mongoose from "mongoose";

const RaffleSchema = new mongoose.Schema({
  date: { type: Date, required: true, default: Date.now },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true, index: true },
  // How many teammates were in the hat for this draw — kept so history stays
  // meaningful after the roster is reset for the next week.
  poolSize: { type: Number },
  drawnBy: { type: String },
});

export default mongoose.models.Raffle || mongoose.model("Raffle", RaffleSchema);
