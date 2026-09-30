import connectDB from "@/db/connection";
import Raffle from "@/db/models/Raffle";
import { route, ApiError } from "@/lib/api";
import { isValidId } from "@/lib/data";
import { fullName } from "@/lib/format";
import { postWinnerToChat, winnerMessage, winnerTextMessage } from "@/lib/google-chat";
import { cardPath, originFrom } from "@/lib/share";

export default route({
  // POST /api/raffles/:id/share — post this draw's winner card to Google Chat.
  // Each draw can be posted once, so test draws and double clicks don't spam.
  async POST(req, res, session) {
    const { id } = req.query;
    if (!isValidId(id)) throw new ApiError(404, "Draw not found.");
    await connectDB();
    const raffle = await Raffle.findById(id).populate("winner", "firstName lastName").lean();
    if (!raffle?.winner) throw new ApiError(404, "Draw not found.");

    const origin = originFrom(req);
    const imageUrl = `${origin}${cardPath(id)}`;
    const name = fullName(raffle.winner);
    const dateOpts = { weekday: "long", month: "long", day: "numeric" };
    let dateLabel;
    try {
      dateLabel = new Intl.DateTimeFormat("en-US", { ...dateOpts, timeZone: raffle.timeZone }).format(raffle.date);
    } catch {
      dateLabel = new Intl.DateTimeFormat("en-US", dateOpts).format(raffle.date);
    }

    // Claim the post first so two quick clicks can't both send it.
    const claimed = await Raffle.findOneAndUpdate(
      { _id: id, sharedAt: { $exists: false } },
      { $set: { sharedAt: new Date(), sharedBy: session.user.email } }
    );
    if (!claimed) throw new ApiError(409, "This winner has already been posted to Google Chat.");

    const details = { raffleId: id, name, firstName: raffle.winner.firstName, dateLabel, poolSize: raffle.poolSize, imageUrl, origin };
    try {
      await postWinnerToChat(winnerMessage(details), winnerTextMessage(details));
    } catch (err) {
      // Let them try again if the post didn't go through.
      await Raffle.updateOne({ _id: id }, { $unset: { sharedAt: 1, sharedBy: 1 } });
      throw err;
    }
    res.status(200).json({ success: true, data: { sharedAt: new Date() } });
  },
});
