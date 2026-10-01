import connectDB from "@/db/connection";
import Employee from "@/db/models/Employee";
import { route, ApiError } from "@/lib/api";
import { backfillInDraw, parseEntries, parseInDraw } from "@/lib/data";
import { MAX_ENTRIES } from "@/lib/raffles";

export default route({
  // PUT /api/reset-entries — change the whole team in a single write:
  //   { inDraw: true|false }  everyone in (or out of) the weekly draw. Typical
  //                           use: "everyone out" on Monday, then flip people
  //                           in as their timesheets land.
  //   { entries: n }          everyone's monthly entries set to n — 0 clears
  //                           them for a new month.
  async PUT(req, res) {
    const body = req.body ?? {};
    await connectDB();

    if ("entries" in body) {
      const entries = parseEntries(body.entries);
      if (entries === null) throw new ApiError(400, `Entries must be a whole number from 0 to ${MAX_ENTRIES}.`);
      await backfillInDraw();
      const result = await Employee.updateMany({}, { $set: { entries } });
      return res.status(200).json({ success: true, data: { entries, updated: result.modifiedCount } });
    }

    const inDraw = parseInDraw(body.inDraw ?? true);
    if (inDraw === null) throw new ApiError(400, "inDraw must be true or false.");
    const result = await Employee.updateMany({}, { $set: { inDraw } });
    res.status(200).json({ success: true, data: { inDraw, updated: result.modifiedCount } });
  },
});
