import connectDB from "@/db/connection";
import Raffle from "@/db/models/Raffle";
import { route, ApiError } from "@/lib/api";
import { isValidId, serialize } from "@/lib/data";

export default route({
  // GET /api/raffles/:id
  async GET(req, res) {
    const { id } = req.query;
    if (!isValidId(id)) throw new ApiError(404, "Raffle not found.");
    await connectDB();
    const raffle = await Raffle.findById(id).populate("winner", "firstName lastName imageURL").lean();
    if (!raffle) throw new ApiError(404, "Raffle not found.");
    res.status(200).json({ success: true, data: serialize(raffle) });
  },

  // DELETE /api/raffles/:id — strike a win from the record.
  async DELETE(req, res) {
    const { id } = req.query;
    if (!isValidId(id)) throw new ApiError(404, "Raffle not found.");
    await connectDB();
    const deleted = await Raffle.findByIdAndDelete(id).lean();
    if (!deleted) throw new ApiError(404, "Raffle not found.");
    res.status(200).json({ success: true, data: {} });
  },
});
