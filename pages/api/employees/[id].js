import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import Raffle from "@/db/models/Raffle";
import { route, ApiError } from "@/lib/api";
import { getEmployeeWithWins, isValidId, parseInDraw, pickEditable, serialize } from "@/lib/data";

export default route({
  // GET /api/employees/:id — profile plus win history.
  async GET(req, res) {
    const result = await getEmployeeWithWins(req.query.id);
    if (!result) throw new ApiError(404, "Employee not found.");
    res.status(200).json({ success: true, data: result.employee, raffles: result.wins });
  },

  // PUT /api/employees/:id — edit details, or flip them in/out of the draw
  // with { inDraw: true|false }.
  async PUT(req, res) {
    const { id } = req.query;
    if (!isValidId(id)) throw new ApiError(404, "Employee not found.");

    const fields = pickEditable(req.body);
    if ("inDraw" in req.body) {
      const entries = parseInDraw(req.body.inDraw);
      if (entries === null) throw new ApiError(400, "inDraw must be true or false.");
      fields.entries = entries;
    }

    await connectDB();
    const employee = await Employee.findByIdAndUpdate(id, fields, {
      new: true,
      runValidators: true,
    }).lean();
    if (!employee) throw new ApiError(404, "Employee not found.");
    res.status(200).json({ success: true, data: serialize(employee) });
  },

  // DELETE /api/employees/:id — remove the teammate and their win history.
  async DELETE(req, res) {
    const { id } = req.query;
    if (!isValidId(id)) throw new ApiError(404, "Employee not found.");

    await connectDB();
    const deleted = await Employee.findByIdAndDelete(id).lean();
    if (!deleted) throw new ApiError(404, "Employee not found.");
    await Raffle.deleteMany({ winner: id });
    res.status(200).json({ success: true, data: {} });
  },
});
