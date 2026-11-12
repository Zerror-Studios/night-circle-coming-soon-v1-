import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Home-screen icon for iPhone / iPad: the same moon as src/app/icon.svg, as a 180 × 180 PNG.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const svg = await readFile(join(process.cwd(), "src/app/icon.svg"));
  const src = `data:image/svg+xml;base64,${svg.toString("base64")}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#111111" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={180} height={180} alt="" />
      </div>
    ),
    size
  );
}
