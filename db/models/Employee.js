import mongoose from "mongoose";
import { MAX_ENTRIES } from "@/lib/raffles";

const EmployeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    imageURL: { type: String, default: "", trim: true },
    // Weekly draw: in once their timesheet is submitted, out if they're
    // sitting the week out. One entry each.
    inDraw: { type: Boolean, default: true },
    // Monthly draw: how many entries they hold. Every entry is a ticket in the
    // hat, so 3 entries are three times the chance of 1. (Until the monthly
    // draw arrived this field held the weekly flag as 0/1 — see
    // backfillInDraw in lib/data.js.)
    entries: {
      type: Number,
      default: 0,
      min: 0,
      max: MAX_ENTRIES,
      validate: { validator: Number.isInteger, message: "Entries must be a whole number." },
    },
    // Email of the teammate who created this record.
    user: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
