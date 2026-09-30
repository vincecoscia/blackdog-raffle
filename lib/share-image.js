import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { BONE_EMBOSS, BONE_INK } from "@/lib/bone";
import { LOGO_VARIANTS, logoSvg } from "@/lib/brand";
import { BONE, CARD, cardScene } from "@/lib/card";

/**
 * The 1200×630 share image layout, used by the winner card (/api/card/:id) and
 * the site's link preview (/api/og): lib/card's scene with the dog holding a
 * bone, the logo top left, and a headline block on the left.
 */

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

/**
 * Render the image as a PNG buffer. `seed` fixes the confetti; `eyebrow`,
 * `title` and `sub` stack on the left; `footnote` sits bottom left (optional);
 * `bone` is stamped on the bone in the dog's mouth.
 */
export async function shareImage({ theme, seed, eyebrow, title, titleSize, sub, footnote, bone }) {
  const scene = `data:image/svg+xml;base64,${Buffer.from(cardScene({ theme, seed })).toString("base64")}`;
  const boneSize = Math.min(32, BONE.labelWidth / (bone.length * 0.6));

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
          <div style={{ display: "flex", fontFamily: "Inter", fontSize: 21, letterSpacing: 5, color: MINT }}>{eyebrow}</div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontFamily: "Bricolage",
              fontSize: titleSize,
              lineHeight: 1.02,
              color: INK,
              letterSpacing: -1,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", marginTop: 22, fontFamily: "Inter", fontSize: 25, color: MUTED }}>{sub}</div>
        </div>

        {footnote ? (
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
            {footnote}
          </div>
        ) : null}

        {/* The label on the bone */}
        <div
          style={{
            position: "absolute",
            left: BONE.x - BONE.labelWidth / 2,
            top: BONE.y - boneSize * 0.62,
            width: BONE.labelWidth,
            display: "flex",
            justifyContent: "center",
            fontFamily: "Bricolage",
            fontSize: boneSize,
            color: BONE_INK,
            textShadow: `0 ${(1.1 * BONE.scale).toFixed(1)}px 0 ${BONE_EMBOSS}`, // stamped, as in the live scene
            lineHeight: 1,
          }}
        >
          {bone}
        </div>
      </div>
    ),
    { ...CARD, fonts: FONTS }
  );

  return Buffer.from(await image.arrayBuffer());
}
