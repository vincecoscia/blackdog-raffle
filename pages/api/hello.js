// Unauthenticated health check (handy for uptime monitors).
export default function handler(req, res) {
  res.status(200).json({ ok: true, app: "blackdog-raffle" });
}
