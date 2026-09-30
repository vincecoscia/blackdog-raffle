import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import connectDB from "@/db/connection";
import Raffle from "@/db/models/Raffle";
import { LOGO_VARIANTS, logoSvg } from "@/lib/brand";
import { BONE, CARD, cardScene } from "@/lib/card";
import { isValidId } from "@/lib/data";
import { fullName } from "@/lib/format";
import { isValidCardSignature } from "@/lib/share";
import { isTheme, themeForDate } from "@/lib/themes";

// Read once per server instance. (Included in the deployment via
// outputFileTracingIncludes in next.config.js.)
const FONTS = [
  {
    name: "Bricolage",
    data: fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "BricolageGrotesque-ExtraBold.ttf")),
    weight: 800,
    style: "normal",
  },
  { name: "Inter", data: fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "Inter-SemiBold.ttf")), weight: 600, style: "normal" },
];
const LOGO = `data:image/svg+xml;base64,${Buffer.from(logoSvg({ registered: false })).toString("base64")}`;
const LOGO_HEIGHT = 56;
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * LOGO_VARIANTS.lockup.viewBox[2]) / LOGO_VARIANTS.lockup.viewBox[3]);

const INK = "#f4fff9";
const MUTED = "#a7a7b5";
const MINT = "#77ddaf";

/** Rough text width for Bricolage ExtraBold, used to fit names without a layout pass. */
const approxWidth = (text, size) => text.length * size * 0.6;

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
  const nameSize = name.length <= 12 ? 92 : name.length <= 18 ? 78 : 62;
  const label = winner.firstName;
  const labelSize = Math.min(32, BONE.labelWidth / (label.length * 0.6));
  const scene = `data:image/svg+xml;base64,${Buffer.from(cardScene({ theme, seed: String(raffle._id) })).toString("base64")}`;

  const image = new ImageResponse(
    (
      <div style={{ width: CARD.width, height: CARD.height, display: "flex", position: "relative", background: "#070709" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={scene} width={CARD.width} height={CARD.height} style={{ position: "absolute", left: 0, top: 0 }} />

        {/* Wordmark */}
        <div style={{ position: "absolute", left: 72, top: 58, display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={LOGO} width={LOGO_WIDTH} height={LOGO_HEIGHT} />
          {/* The wordmark sits low in the lockup; nudge these onto its baseline. */}
          <div style={{ width: 2, height: 26, marginLeft: 18, marginTop: 7, background: "rgba(255,255,255,0.18)" }} />
          <div style={{ display: "flex", marginLeft: 18, marginTop: 8, fontFamily: "Bricolage", fontSize: 22, letterSpacing: 4, color: MINT }}>
            RAFFLE
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            position: "absolute",
            left: 72,
            top: 170,
            width: 560,
            height: 330,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 21, letterSpacing: 5, color: MINT }}>AND THE WINNER IS</div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontFamily: "Bricolage",
              fontSize: nameSize,
              lineHeight: 1.02,
              color: INK,
              letterSpacing: -1,
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", marginTop: 22, fontFamily: "Inter", fontSize: 25, color: MUTED }}>
            {formatDate(raffle.date, raffle.timeZone)}
          </div>
        </div>

        {raffle.poolSize ? (
          <div
            style={{
              position: "absolute",
              left: 72,
              bottom: 44,
              display: "flex",
              alignItems: "center",
              fontFamily: "Inter",
              fontSize: 20,
              color: "#7e7e8e",
            }}
          >
            <div style={{ width: 9, height: 9, borderRadius: 9, background: MINT, marginRight: 12 }} />
            Picked at random from {raffle.poolSize} teammates
          </div>
        ) : null}

        {/* The name on the bone */}
        <div
          style={{
            position: "absolute",
            left: BONE.x - BONE.labelWidth / 2,
            top: BONE.y - labelSize * 0.62,
            width: BONE.labelWidth,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Bricolage",
            fontSize: labelSize,
            color: "#2a2320",
            lineHeight: 1,
          }}
        >
          {label}
        </div>
      </div>
    ),
    { ...CARD, fonts: FONTS }
  );

  const png = Buffer.from(await image.arrayBuffer());
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
  if (download) {
    const slug = winner.firstName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    res.setHeader("Content-Disposition", `attachment; filename="blackdog-raffle-${slug}.png"`);
  }
  res.status(200).send(png);
}
