import { route } from "@/lib/api";
import { drawWinner, getRecentWinners } from "@/lib/data";

export default route({
  // GET /api/raffle — most recent winners, newest first.
  async GET(req, res) {
    const limit = Math.min(Number(req.query.limit) || 8, 50);
    res.status(200).json({ success: true, data: await getRecentWinners(limit) });
  },

  // POST /api/raffle — draw a winner. The server picks and records the win
  // atomically; the client only animates toward the result.
  async POST(req, res, session) {
    const result = await drawWinner({ drawnBy: session.user.email });
    res.status(201).json({ success: true, data: result });
  },
});
