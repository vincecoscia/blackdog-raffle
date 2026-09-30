import { route } from "@/lib/api";
import { drawWinner, getRecentWinners } from "@/lib/data";
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

  // POST /api/raffle { theme, timeZone } — draw a winner. The server picks and
  // records the win atomically; the client only animates toward the result.
  // `theme` (the skin on screen) and `timeZone` only style the winner card.
  async POST(req, res, session) {
    const { theme, timeZone } = req.body ?? {};
    const result = await drawWinner({
      drawnBy: session.user.email,
      theme: isTheme(theme) ? theme : null,
      timeZone: validTimeZone(timeZone),
    });
    res.status(201).json({ success: true, data: { ...result, cardUrl: cardPath(result.raffle._id) } });
  },
});
