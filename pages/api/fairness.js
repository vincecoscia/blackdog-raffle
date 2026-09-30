import { route } from "@/lib/api";
import { fairnessDemo } from "@/lib/draw";

const clampInt = (value, lo, hi, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export default route({
  // GET /api/fairness?n=25&draws=100000 — run test draws through the real pick
  // function (nothing is recorded) and report how evenly they landed.
  async GET(req, res) {
    const n = clampInt(req.query.n, 2, 500, 25);
    const draws = clampInt(req.query.draws, 1_000, 1_000_000, 100_000);
    res.status(200).json({ success: true, data: fairnessDemo(n, draws) });
  },
});
