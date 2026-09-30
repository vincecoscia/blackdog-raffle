import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import { route, ApiError } from "@/lib/api";
import { getEmployees, parseInDraw, pickEditable, serialize } from "@/lib/data";

export default route({
  // GET /api/employees — the whole roster, sorted by first name.
  async GET(req, res) {
    res.status(200).json({ success: true, data: await getEmployees() });
  },

  // POST /api/employees — add a teammate.
  async POST(req, res, session) {
    const fields = pickEditable(req.body);
    if (!fields.firstName?.trim() || !fields.lastName?.trim() || !fields.email?.trim()) {
      throw new ApiError(400, "First name, last name and email are required.");
    }
    const entries = parseInDraw(req.body.inDraw ?? true);
    if (entries === null) throw new ApiError(400, "inDraw must be true or false.");
    await connectDB();
    const employee = await Employee.create({ ...fields, entries, user: session.user.email });
    res.status(201).json({ success: true, data: serialize(employee) });
  },
});
