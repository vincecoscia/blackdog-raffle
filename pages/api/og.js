import { shareImage } from "@/lib/share-image";
import { isTheme, themeForDate } from "@/lib/themes";

/**
 * GET /api/og — the link-preview image (og:image) for every page: the pup
 * holding a bone that says "You?", in today's seasonal skin. Public, so
 * iMessage, Google Chat, Slack etc. can fetch it without signing in.
 */
export default async function og(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", ["GET", "HEAD"]);
    return res.status(405).end();
  }

  let theme = themeForDate(new Date());
  // Preview any skin while developing: ?theme=halloween (or none).
  if (process.env.NODE_ENV !== "production" && req.query.theme) theme = isTheme(req.query.theme) ? req.query.theme : null;

  const png = await shareImage({
    theme,
    seed: "og",
    eyebrow: "EVERY WEEK, ONE WINNER",
    title: "Who’s next?",
    titleSize: 92,
    sub: "The Blackdog team’s weekly raffle",
    footnote: "Picked at random, fetched by the dog",
    bone: "You?",
  });

  res.setHeader("Content-Type", "image/png");
  // The skin follows the calendar, so refresh daily.
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(png);
}
