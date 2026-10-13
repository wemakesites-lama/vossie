import type {
  Availability,
  Condition,
  Handover,
  ImageRef,
  Listing,
  ListingKind,
  PayMode,
  TrustBadge,
} from "@/lib/types";

type Options = {
  /** Services priced "From R400". */
  from?: boolean;
  payMode?: PayMode;
  kind?: ListingKind;
  /** Items only. Services never have one. */
  condition?: Condition;
  handover?: Handover;
  /** Which of the campus's two pickup points, when the handover is "pickup". */
  pickup?: "library" | "reception";
  swapFor?: string;
  morePhotos?: readonly ImageRef[];
  availability?: Availability;
};

/** A labelled placeholder for the second or third photo (plan decision 15). */
const photo = (n: 2 | 3, alt: string): ImageRef => ({ src: `/placeholders/photo/${n}.svg`, alt });

const listing = (
  id: string,
  title: string,
  priceZar: number | null,
  campusSlug: string,
  categorySlug: string,
  sellerSlug: string,
  badge: TrustBadge | null,
  createdAt: string,
  description: string,
  {
    from = false,
    payMode = priceZar === null ? "swap" : "cash",
    kind = "item",
    condition = "good",
    handover = kind === "service" ? "on-campus-or-online" : "pickup",
    pickup = "library",
    swapFor,
    morePhotos = [],
    availability = "available",
  }: Options = {},
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
  kind,
  categorySlug,
  sellerSlug,
  morePhotos,
  description,
  condition: kind === "service" ? null : condition,
  handover,
  pickupPointId: handover === "pickup" ? `pp-${campusSlug}-${pickup}` : null,
  swapFor: swapFor ?? null,
  availability,
});

const service = { kind: "service" } as const;

// Newest first. Every campus has listings except Mbombela, so its empty state can be tested. l-016 is paused and
// l-026 is sold (plan decision 14). Free items are R0; swap-only items have no price. Each listing's badge is its
// seller's (shopping spec 6.1).
export const listings: readonly Listing[] = [
  listing(
    "l-001", "Casio fx-991ZA Plus calculator", 250, "midrand", "tech", "tech-corner", "responsive", "2026-10-12T07:40:00Z",
    "Approved for Eduvos maths and stats exams. Works perfectly, with a new battery fitted in September.\nComes with the slide-on cover.",
    {
      condition: "like-new",
      morePhotos: [photo(2, "The back of the calculator, with the battery cover"), photo(3, "The slide-on cover")],
    },
  ),
  listing(
    "l-018", "HP laptop charger, 65W", 220, "bedfordview", "tech", "phone-fix", "responsive", "2026-10-12T07:05:00Z",
    "Original HP 65W charger with the round pin. Tested and working.",
    { condition: "like-new" },
  ),
  listing(
    "l-002", "Intro to Financial Accounting, 4th edition", 300, "midrand", "textbooks-notes", "book-swap", "trusted",
    "2026-10-12T06:55:00Z",
    "The prescribed book for Accounting 1. A few highlighted pages, none torn.",
  ),
  listing(
    "l-013", "Python tutoring for beginners, one hour", 150, "pretoria", "tutoring", "code-coach", "trusted",
    "2026-10-12T06:30:00Z",
    "Loops, functions and your first project, at your pace. Bring your laptop, or we meet over video.",
    service,
  ),
  listing(
    "l-024", "Bunny chow lunch special", 75, "durban-umhlanga", "food", "res-kitchen", "trusted", "2026-10-12T06:20:00Z",
    "A quarter mutton bunny with a side salad. Order by 10am and collect at lunch.",
    { condition: "new" },
  ),
  listing(
    "l-003", "Bar fridge, 90 litres", 1200, "midrand", "res-living", "res-deals", "trusted", "2026-10-12T06:10:00Z",
    "Moving out of res, so the fridge has to go. Quiet, cold and clean, with a small freezer box.\nBring a friend to help carry it.",
    { pickup: "reception", morePhotos: [photo(2, "Inside the fridge, with the freezer box")] },
  ),
  listing(
    "l-021", "Bicycle, 21 gears", 1500, "cape-town-mowbray", "res-living", "weekend-market", "new-seller",
    "2026-10-12T05:30:00Z",
    "A mountain bike with 21 gears, serviced last month. The lock is included.",
    {
      pickup: "reception",
      morePhotos: [photo(2, "The gears and the back wheel"), photo(3, "The lock that comes with it")],
    },
  ),
  listing(
    "l-030", "CV and LinkedIn makeover", 200, "online", "services", "cv-clinic", "trusted", "2026-10-12T04:15:00Z",
    "I rewrite your CV and LinkedIn profile for the jobs you want, in three working days.",
    { ...service, handover: "online", from: true },
  ),
  listing(
    "l-004", "Box braids, shoulder length", 400, "midrand", "hair-beauty", "hair-studio", "trusted", "2026-10-11T18:20:00Z",
    "Shoulder-length box braids, about five hours. The price includes the hair.\nBook a weekday afternoon or a Saturday morning.",
    { ...service, handover: "on-campus", from: true },
  ),
  listing(
    "l-031", "Spreadsheet tutoring over video", 130, "online", "tutoring", "study-notes", "responsive",
    "2026-10-11T17:10:00Z",
    "Excel and Google Sheets, from formulas to pivot tables, over video.",
    { ...service, handover: "online" },
  ),
  listing(
    "l-014", "Electric kettle, 1.7 litres", 200, "pretoria", "res-living", "res-essentials", "responsive",
    "2026-10-11T16:45:00Z",
    "A stainless steel kettle that boils fast. The auto switch-off works, and it's been descaled.",
  ),
  listing(
    "l-005", "Statistics 1 exam prep, one hour", 120, "midrand", "tutoring", "maths-tutor", "responsive",
    "2026-10-11T16:05:00Z",
    "One-on-one help with past papers, hypothesis tests and probability, in the library or over video.",
    service,
  ),
  listing(
    "l-023", "Gel nails, full set", 250, "cape-town-tyger-valley", "hair-beauty", "nail-bar", "responsive",
    "2026-10-11T14:35:00Z",
    "A full gel set in the colour of your choice, about an hour and a half.",
    { ...service, handover: "on-campus", from: true },
  ),
  listing(
    "l-006", "Desk lamp with a USB port", 180, "midrand", "res-living", "res-deals", "trusted", "2026-10-11T12:30:00Z",
    "A warm LED desk lamp with a USB port to charge your phone. It bends any way you need.",
    { condition: "like-new" },
  ),
  listing(
    "l-015", "Thrifted puffer jacket", 280, "pretoria", "fashion-thrift", "thrift-rack", "new-seller",
    "2026-10-11T11:30:00Z",
    "A black puffer jacket, size L, washed and ready for winter.",
  ),
  listing(
    "l-027", "Res curtains, two panels", 120, "nelson-mandela-bay", "res-living", "room-refresh", "new-seller",
    "2026-10-11T10:40:00Z",
    "Two blackout curtain panels that fit a standard res window.",
  ),
  listing(
    "l-007", "Gaming headset, barely used", 450, "midrand", "tech", "tech-corner", "responsive", "2026-10-11T09:15:00Z",
    "An over-ear headset with a detachable mic. Used for one semester; the ear pads are like new.",
    { payMode: "both", condition: "like-new", swapFor: "a mechanical keyboard or a Bluetooth speaker" },
  ),
  listing(
    "l-020", "Mini oven for res", 650, "bloemfontein", "res-living", "kitchen-kit", "trusted", "2026-10-11T08:30:00Z",
    "A 25-litre oven with a grill, just right for res. The tray and rack are included.",
  ),
  listing(
    "l-008", "Business Management 1 summary notes", 90, "midrand", "textbooks-notes", "book-swap", "trusted",
    "2026-10-10T19:40:00Z",
    "Typed summaries of every chapter, printed and bound. They got me 78% in the exam.",
  ),
  listing(
    "l-022", "Film camera, working", 900, "cape-town-mowbray", "tech", "weekend-market", "new-seller",
    "2026-10-10T16:20:00Z",
    "A 35mm film camera with a 50mm lens, tested with a roll last month.",
  ),
  listing(
    "l-009", "Cupcake box, a dozen", 150, "midrand", "food", "home-bakery", "trusted", "2026-10-10T14:00:00Z",
    "Twelve vanilla or chocolate cupcakes, baked the morning you collect. Order a day ahead.",
    { condition: "new" },
  ),
  listing(
    "l-016", "Lash extensions, classic set", 300, "pretoria", "hair-beauty", "lash-lounge", "trusted",
    "2026-10-10T13:15:00Z",
    "A classic set that lasts three to four weeks. It takes about two hours.",
    { ...service, handover: "on-campus", from: true, availability: "paused" },
  ),
  listing(
    "l-019", "Economics 1 textbook", 320, "bedfordview", "textbooks-notes", "bookshelf", "trusted",
    "2026-10-10T12:10:00Z",
    "The current edition, with a few pencil notes in the margins.",
  ),
  listing(
    "l-029", "Engineering drawing set", 350, "vanderbijlpark", "stationery", "drawing-office", "trusted",
    "2026-10-10T11:05:00Z",
    "A full drawing set with compasses, scales and set squares in a hard case.",
    { condition: "like-new" },
  ),
  listing(
    "l-010", "Denim jacket, size M", null, "midrand", "fashion-thrift", "closet-clear-out", "new-seller",
    "2026-10-10T10:25:00Z",
    "A classic blue denim jacket, size M, worn a handful of times.",
    { swapFor: "a hoodie, or sneakers in size 7" },
  ),
  listing(
    "l-026", "Sharp scientific calculator", 180, "east-london", "tech", "study-desk", null, "2026-10-10T07:55:00Z",
    "A Sharp scientific calculator in good working order.",
    { availability: "sold" },
  ),
  listing(
    "l-025", "Accounting 2 tutor, two hours", 240, "durban-umhlanga", "tutoring", "accounting-tutor", "trusted",
    "2026-10-09T17:00:00Z",
    "Two hours on consolidations, cash flows or whatever is giving you trouble.",
    service,
  ),
  listing(
    "l-011", "Logo design for your hustle", 350, "midrand", "services", "design-studio", "responsive",
    "2026-10-09T15:10:00Z",
    "A logo and colour set for your small business, with two rounds of changes. Files ready for print and Instagram.",
    { ...service, from: true },
  ),
  listing(
    "l-028", "Rugby jersey, size L", 200, "potchefstroom", "fashion-thrift", "sports-kit", "responsive",
    "2026-10-09T13:20:00Z",
    "A replica home jersey, size L, washed and ironed.",
    { payMode: "both", swapFor: "a cricket shirt or gym gear" },
  ),
  listing(
    "l-017", "Graph paper and highlighter bundle", 60, "pretoria", "stationery", "stationery-stop", null,
    "2026-10-09T09:40:00Z",
    "Two pads of graph paper and six highlighters, all unopened.",
    { condition: "new" },
  ),
  listing(
    "l-012", "Matric dance tickets, a pair", 600, "midrand", "tickets-events", "ticket-desk", null, "2026-10-09T08:00:00Z",
    "Two tickets to a matric dance in Midrand on 31 October. The names on the booking can be changed.",
    { condition: "new" },
  ),

  // Giveaways and swap-only items, once a separate list (the "fs-" ids are kept, so old links still work). They're
  // dated before every other listing, so Just listed doesn't change (plan decision 7).
  listing(
    "fs-001", "Business Management 1 notes", 0, "midrand", "textbooks-notes", "book-swap", "trusted",
    "2026-10-08T18:00:00Z",
    "Handwritten notes for every chapter. Free to a first-year who needs them.",
    { condition: "fair" },
  ),
  listing(
    "fs-002", "Desk lamp, swap for a kettle", null, "pretoria", "res-living", "res-essentials", "responsive",
    "2026-10-08T16:00:00Z",
    "A working desk lamp. I'd rather swap it for a kettle than sell it.",
    { swapFor: "a kettle" },
  ),
  listing(
    "fs-003", "Res curtains, two panels", 0, "midrand", "res-living", "res-deals", "trusted", "2026-10-08T14:00:00Z",
    "Two curtain panels that fit a res window. Free if you collect this week.",
  ),
  listing(
    "fs-004", "Logo design for a photo shoot", null, "online", "services", "logo-lab", null, "2026-10-08T12:00:00Z",
    "I'll design your logo if you'll take photos for my brand.",
    { ...service, handover: "online", swapFor: "a photo shoot for my brand" },
  ),
  listing(
    "fs-005", "Hangers, bag of 20", 0, "bedfordview", "res-living", "moving-out-sale", null, "2026-10-08T10:00:00Z",
    "Twenty plastic hangers, free to whoever collects first.",
  ),
  listing(
    "fs-006", "Calculator for a textbook", null, "cape-town-mowbray", "tech", "weekend-market", "new-seller",
    "2026-10-08T08:00:00Z",
    "A scientific calculator I no longer need. I'm swapping it for a first-year textbook.",
    { swapFor: "an Accounting 1 textbook" },
  ),
  listing(
    "fs-007", "Highlighters, half used", 0, "east-london", "stationery", "study-desk", null, "2026-10-08T06:00:00Z",
    "A pack of highlighters, about half used. Free to a good home.",
    { condition: "fair" },
  ),
];
