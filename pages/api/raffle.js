import { route, ApiError } from "@/lib/api";
import { drawWinner, getRecentWinners } from "@/lib/data";
import { DEFAULT_KIND, isRaffleKind } from "@/lib/raffles";
import { cardPath } from "@/lib/share";
import { isTheme } from "@/lib/themes";

const validTimeZone = (tz) => {
  if (typeof tz !== "string" || tz.length > 64) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
};

export default route({
  // GET /api/raffle — most recent winners, newest first.
  async GET(req, res) {
    const limit = Math.min(Number(req.query.limit) || 8, 50);
    res.status(200).json({ success: true, data: await getRecentWinners(limit) });
  },

  // POST /api/raffle { kind, theme, timeZone } — draw a winner of the weekly
  // (default) or monthly raffle. The server picks and records the win
  // atomically; the client only animates toward the result. `theme` (the skin
  // on screen) and `timeZone` only style the winner card.
  async POST(req, res, session) {
    const { kind = DEFAULT_KIND, theme, timeZone } = req.body ?? {};
    if (!isRaffleKind(kind)) throw new ApiError(400, "kind must be weekly or monthly.");
    const result = await drawWinner({
      kind,
      drawnBy: session.user.email,
      theme: isTheme(theme) ? theme : null,
      timeZone: validTimeZone(timeZone),
    });
    res.status(201).json({ success: true, data: { ...result, cardUrl: cardPath(result.raffle._id) } });
  },
});
