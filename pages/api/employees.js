import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import { route, ApiError } from "@/lib/api";
import { getEmployees, parseEntries, parseInDraw, pickEditable, serialize } from "@/lib/data";
import { MAX_ENTRIES } from "@/lib/raffles";

export default route({
  // GET /api/employees — the whole roster, sorted by first name.
  async GET(req, res) {
    res.status(200).json({ success: true, data: await getEmployees() });
  },

  // POST /api/employees — add a teammate, optionally with { inDraw, entries }.
  async POST(req, res, session) {
    const fields = pickEditable(req.body);
    if (!fields.firstName?.trim() || !fields.lastName?.trim() || !fields.email?.trim()) {
      throw new ApiError(400, "First name, last name and email are required.");
    }
    const inDraw = parseInDraw(req.body.inDraw ?? true);
    if (inDraw === null) throw new ApiError(400, "inDraw must be true or false.");
    const entries = parseEntries(req.body.entries ?? 0);
    if (entries === null) throw new ApiError(400, `Entries must be a whole number from 0 to ${MAX_ENTRIES}.`);
    await connectDB();
    const employee = await Employee.create({ ...fields, inDraw, entries, user: session.user.email });
    res.status(201).json({ success: true, data: serialize(employee) });
  },
});
