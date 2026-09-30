import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    imageURL: { type: String, default: "", trim: true },
    // 1 = in this week's draw (timesheet submitted), 0 = sitting out. The field
    // keeps its historical name so existing documents work untouched.
    entries: { type: Number, default: 1, min: 0, max: 1 },
    // Email of the teammate who created this record.
    user: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
