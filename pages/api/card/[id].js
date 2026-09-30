import connectDB from "@/db/connection";
import Raffle from "@/db/models/Raffle";
import { isValidId } from "@/lib/data";
import { fullName } from "@/lib/format";
import { isValidCardSignature } from "@/lib/share";
import { shareImage } from "@/lib/share-image";
import { isTheme, themeForDate } from "@/lib/themes";

function formatDate(date, timeZone) {
  const opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  try {
    return new Intl.DateTimeFormat("en-US", { ...opts, timeZone }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(date));
  }
}

/**
 * GET /api/card/:id?sig=… — the shareable winner card for one draw, as a PNG.
 * Public (Google Chat fetches it) but only for a valid signature; add
 * `&download=1` to save it as a file.
 */
export default async function card(req, res) {
  const { id, sig, download } = req.query;
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }
  if (!isValidId(id) || !isValidCardSignature(id, sig)) return res.status(404).end();

  await connectDB();
  const raffle = await Raffle.findById(id).populate("winner", "firstName lastName").lean();
  if (!raffle?.winner) return res.status(404).end();

  const { winner } = raffle;
  // The skin that was on screen for this draw, falling back to its date.
  let theme = raffle.theme !== undefined ? raffle.theme : themeForDate(raffle.date);
  // Preview any skin while developing: &theme=halloween (or none).
  if (process.env.NODE_ENV !== "production" && req.query.theme) theme = isTheme(req.query.theme) ? req.query.theme : null;
  const name = fullName(winner);
  const png = await shareImage({
    theme,
    seed: String(raffle._id),
    eyebrow: "AND THE WINNER IS",
    title: name,
    titleSize: name.length <= 12 ? 92 : name.length <= 18 ? 78 : 62,
    sub: formatDate(raffle.date, raffle.timeZone),
    footnote: raffle.poolSize ? `Picked at random from ${raffle.poolSize} teammates` : null,
    bone: winner.firstName,
  });

  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
  if (download) {
    const slug = winner.firstName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    res.setHeader("Content-Disposition", `attachment; filename="blackdog-raffle-${slug}.png"`);
  }
  res.status(200).send(png);
}
