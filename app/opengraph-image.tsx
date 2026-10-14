import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Vossie, the student marketplace for every Eduvos campus";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white crest, read once, as the listing and seller cards do. Until Eduvos's font files arrive, the card uses
// next/og's built-in font: it can't read the woff2 files next/font serves (shopping plan decision 10).
const crest = `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/brand/crest-white.png"))).toString("base64")}`;

/**
 * The default share card (info and system spec 2.12): every page without a card of its own shows this in a link
 * preview. Navy, the white crest, the name and what Vossie is. The listing and seller cards override it on their routes.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 72,
          padding: "72px 96px",
          background: "#15305D",
          color: "#FFFFFF",
        }}
      >
        <img src={crest} width={181} height={304} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 28, flex: 1 }}>
          <div style={{ fontSize: 120, lineHeight: 1, letterSpacing: 6 }}>VOSSIE</div>
          <div style={{ fontSize: 44, lineHeight: 1.2 }}>The student marketplace for every Eduvos campus</div>
        </div>
      </div>
    ),
    size,
  );
}
