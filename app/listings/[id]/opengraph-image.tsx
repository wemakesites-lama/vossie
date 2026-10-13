import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getListingDetail } from "@/lib/data";
import { priceLabel, shareCardAlt, shortDescription } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white crest, read once. Until Eduvos's font files arrive, the card uses next/og's built-in font: it can't read
// the woff2 files next/font serves (plan decision 10).
const crest = `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/brand/crest-white.png"))).toString("base64")}`;

type Props = { params: Promise<{ id: string }> };

/**
 * One card per listing, with alt text saying what, how much and where (spec 5.8). An unknown listing has no card: with
 * no images, Next answers 404 instead of serving a generic card that would be cached for a year.
 */
export async function generateImageMetadata({ params }: Props) {
  const { id } = await params;
  const detail = await getListingDetail(id);
  if (!detail) return [];
  const alt = shareCardAlt(detail.listing.title, priceLabel(detail.listing), detail.campus.name);
  return [{ id: "card", alt, size, contentType }];
}

/** The link preview WhatsApp shows (spec 5.8): navy, the crest, the campus, the title and the price in large sky. */
export default async function Image({ params }: Props) {
  const { id } = await params;
  const detail = await getListingDetail(id);
  // Capped, so a long title can't run past the 630px height.
  const title = detail ? shortDescription(detail.listing.title, 90) : "Vossie";
  const price = detail ? priceLabel(detail.listing) : "";
  const campus = detail?.campus.name ?? "Every Eduvos campus";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "72px 88px",
          background: "#15305D",
          color: "#FFFFFF",
        }}
      >
        <img src={crest} width={181} height={304} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
          <div style={{ fontSize: 30, letterSpacing: 2, textTransform: "uppercase" }}>{`Vossie · ${campus}`}</div>
          <div style={{ fontSize: 64, lineHeight: 1.05 }}>{title}</div>
          {price && <div style={{ fontSize: 96, lineHeight: 1, color: "#29ABE2" }}>{price}</div>}
        </div>
      </div>
    ),
    size,
  );
}
