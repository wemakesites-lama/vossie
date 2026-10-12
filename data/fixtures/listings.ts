import type { Listing, PayMode, TrustBadge } from "@/lib/types";

type Options = { from?: boolean; payMode?: PayMode };

const listing = (
  id: string,
  title: string,
  priceZar: number | null,
  campusSlug: string,
  categorySlug: string,
  badge: TrustBadge | null,
  createdAt: string,
  { from = false, payMode = priceZar === null ? "swap" : "cash" }: Options = {},
): Listing => ({
  id,
  title,
  priceZar,
  priceIsFrom: from,
  payMode,
  campusSlug,
  // Sellers will upload their own photos; until then each listing shows its category's placeholder.
  image: { src: `/placeholders/listing/${categorySlug}.svg`, alt: title },
  badge,
  createdAt,
});

// Newest first. Every campus has listings except Mbombela, so its empty state can be tested.
export const listings: readonly Listing[] = [
  listing("l-001", "Casio fx-991ZA Plus calculator", 250, "midrand", "tech", "responsive", "2026-10-12T07:40:00Z"),
  listing("l-018", "HP laptop charger, 65W", 220, "bedfordview", "tech", "responsive", "2026-10-12T07:05:00Z"),
  listing("l-002", "Intro to Financial Accounting, 4th edition", 300, "midrand", "textbooks-notes", "new-seller", "2026-10-12T06:55:00Z"),
  listing("l-013", "Python tutoring for beginners, one hour", 150, "pretoria", "tutoring", "trusted", "2026-10-12T06:30:00Z"),
  listing("l-024", "Bunny chow lunch special", 75, "durban-umhlanga", "food", "trusted", "2026-10-12T06:20:00Z"),
  listing("l-003", "Bar fridge, 90 litres", 1200, "midrand", "res-living", "trusted", "2026-10-12T06:10:00Z"),
  listing("l-021", "Bicycle, 21 gears", 1500, "cape-town-mowbray", "res-living", null, "2026-10-12T05:30:00Z"),
  listing("l-030", "CV and LinkedIn makeover", 200, "online", "services", "trusted", "2026-10-12T04:15:00Z", { from: true }),
  listing("l-004", "Box braids, shoulder length", 400, "midrand", "hair-beauty", "trusted", "2026-10-11T18:20:00Z", { from: true }),
  listing("l-031", "Spreadsheet tutoring over video", 130, "online", "tutoring", "responsive", "2026-10-11T17:10:00Z"),
  listing("l-014", "Electric kettle, 1.7 litres", 200, "pretoria", "res-living", "responsive", "2026-10-11T16:45:00Z"),
  listing("l-005", "Statistics 1 exam prep, one hour", 120, "midrand", "tutoring", "responsive", "2026-10-11T16:05:00Z"),
  listing("l-023", "Gel nails, full set", 250, "cape-town-tyger-valley", "hair-beauty", "responsive", "2026-10-11T14:35:00Z", { from: true }),
  listing("l-006", "Desk lamp with a USB port", 180, "midrand", "res-living", null, "2026-10-11T12:30:00Z"),
  listing("l-015", "Thrifted puffer jacket", 280, "pretoria", "fashion-thrift", "new-seller", "2026-10-11T11:30:00Z"),
  listing("l-027", "Res curtains, two panels", 120, "nelson-mandela-bay", "res-living", "new-seller", "2026-10-11T10:40:00Z"),
  listing("l-007", "Gaming headset, barely used", 450, "midrand", "tech", "responsive", "2026-10-11T09:15:00Z", { payMode: "both" }),
  listing("l-020", "Mini oven for res", 650, "bloemfontein", "res-living", "trusted", "2026-10-11T08:30:00Z"),
  listing("l-008", "Business Management 1 summary notes", 90, "midrand", "textbooks-notes", "trusted", "2026-10-10T19:40:00Z"),
  listing("l-022", "Film camera, working", 900, "cape-town-mowbray", "tech", "new-seller", "2026-10-10T16:20:00Z"),
  listing("l-009", "Cupcake box, a dozen", 150, "midrand", "food", "trusted", "2026-10-10T14:00:00Z"),
  listing("l-016", "Lash extensions, classic set", 300, "pretoria", "hair-beauty", "trusted", "2026-10-10T13:15:00Z", { from: true }),
  listing("l-019", "Economics 1 textbook", 320, "bedfordview", "textbooks-notes", "trusted", "2026-10-10T12:10:00Z"),
  listing("l-029", "Engineering drawing set", 350, "vanderbijlpark", "stationery", "trusted", "2026-10-10T11:05:00Z"),
  listing("l-010", "Denim jacket, size M", null, "midrand", "fashion-thrift", "new-seller", "2026-10-10T10:25:00Z"),
  listing("l-026", "Sharp scientific calculator", 180, "east-london", "tech", null, "2026-10-10T07:55:00Z"),
  listing("l-025", "Accounting 2 tutor, two hours", 240, "durban-umhlanga", "tutoring", "trusted", "2026-10-09T17:00:00Z"),
  listing("l-011", "Logo design for your hustle", 350, "midrand", "services", "responsive", "2026-10-09T15:10:00Z", { from: true }),
  listing("l-028", "Rugby jersey, size L", 200, "potchefstroom", "fashion-thrift", "responsive", "2026-10-09T13:20:00Z", { payMode: "both" }),
  listing("l-017", "Graph paper and highlighter bundle", 60, "pretoria", "stationery", null, "2026-10-09T09:40:00Z"),
  listing("l-012", "Matric dance tickets, a pair", 600, "midrand", "tickets-events", null, "2026-10-09T08:00:00Z"),
];
