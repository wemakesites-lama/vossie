import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getCampuses, getSeller } from "@/lib/data";
import { sellerCardAlt, shortDescription } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The white crest, read once. The card uses next/og's built-in font, as the listings' cards do, until Eduvos's font
// files arrive.
const crest = `data:image/png;base64,${(await readFile(join(process.cwd(), "assets/brand/crest-white.png"))).toString("base64")}`;

type Props = { params: Promise<{ slug: string }> };

async function lookUp(slug: string) {
  const [seller, campuses] = await Promise.all([getSeller(slug), getCampuses()]);
  if (!seller) return null;
  return { seller, campusName: campuses.find((campus) => campus.slug === seller.campusSlug)?.name ?? "Eduvos" };
}

/**
 * One card per seller, with alt text saying who, what and where (shopping spec 4.3). An unknown seller has no card:
 * with no images, Next answers 404 instead of serving a generic card that would be cached for a year.
 */
export async function generateImageMetadata({ params }: Props) {
  const { slug } = await params;
  const found = await lookUp(slug);
  if (!found) return [];
  const alt = sellerCardAlt(found.seller.name, found.seller.category, found.campusName);
  return [{ id: "card", alt, size, contentType }];
}

/** The link preview WhatsApp shows: navy, the crest, "Vossie · {campus}", and the seller's name and tagline in white. */
export default async function Image({ params }: Props) {
  const { slug } = await params;
  const found = await lookUp(slug);
  // Capped, so long text can't run past the 630px height.
  const name = found ? shortDescription(found.seller.name, 40) : "Vossie";
  const tagline = found ? shortDescription(found.seller.tagline, 110) : "";
  const campus = found?.campusName ?? "Every Eduvos campus";

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
          <div style={{ fontSize: 88, lineHeight: 1, textTransform: "uppercase" }}>{name}</div>
          {tagline && <div style={{ fontSize: 40, lineHeight: 1.2 }}>{tagline}</div>}
        </div>
      </div>
    ),
    size,
  );
}
