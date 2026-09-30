import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import { route, ApiError } from "@/lib/api";
import { parseInDraw } from "@/lib/data";

export default route({
  // PUT /api/reset-entries { inDraw } — put everyone in (or take everyone out
  // of) the draw in a single write. Typical use: "everyone out" on Monday,
  // then flip people in as their timesheets land.
  async PUT(req, res) {
    const entries = parseInDraw(req.body?.inDraw ?? true);
    if (entries === null) throw new ApiError(400, "inDraw must be true or false.");

    await connectDB();
    const result = await Employee.updateMany({}, { $set: { entries } });
    res.status(200).json({ success: true, data: { inDraw: entries === 1, updated: result.modifiedCount } });
  },
});
