import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

// Share preview (Facebook, LinkedIn, WhatsApp, X, Slack…): the Night Circle logo on the
// site's dark wall with "COMING SOON" underneath. 1200 × 630 PNG, built at build time.
export const alt = siteConfig.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LOGO_COLOR = "#A8A69F"; // same as the logo on the page

export default async function OpengraphImage() {
  const svg = (await readFile(join(process.cwd(), "public/images/night-circle-logo.svg"), "utf8")).replace(
    /fill="#ffffff"/gi,
    `fill="${LOGO_COLOR}"`
  );
  const logo = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, #1c1c1c 0%, #111111 60%, #0b0b0b 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} width={860} height={194} alt="" />
        <div
          style={{
            marginTop: 56,
            fontSize: 26,
            letterSpacing: 12,
            color: "#8f8d88",
          }}
        >
          COMING SOON
        </div>
      </div>
    ),
    size
  );
}
