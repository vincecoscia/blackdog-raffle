const mongoose = require("mongoose");

const raffleSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  winner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
  },
});

module.exports = mongoose.models.Raffle || mongoose.model("Raffle", raffleSchema);
