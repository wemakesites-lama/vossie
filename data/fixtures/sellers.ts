import type { Seller, TrustBadge } from "@/lib/types";

// The category names as shown, by slug. Fixtures import nothing at run time (scripts/make-placeholders.ts runs them in
// plain Node), so these repeat data/fixtures/categories.ts, and a fixture test checks the two agree.
const CATEGORY_NAMES: Record<string, string> = {
  "textbooks-notes": "Textbooks & notes",
  tech: "Tech",
  "res-living": "Res & living",
  "fashion-thrift": "Fashion & thrift",
  food: "Food",
  "hair-beauty": "Hair & beauty",
  tutoring: "Tutoring",
  services: "Services",
  "tickets-events": "Tickets & events",
  stationery: "Stationery",
};

type Standing = {
  verified?: boolean;
  badge: TrustBadge | null;
  /** YYYY-MM. */
  since: string;
};

const seller = (
  slug: string,
  name: string,
  tagline: string,
  categorySlug: string,
  campusSlug: string,
  { verified = false, badge, since }: Standing,
  about: string,
): Seller => ({
  slug,
  name,
  tagline,
  category: CATEGORY_NAMES[categorySlug],
  categorySlug,
  campusSlug,
  verified,
  badge,
  about,
  since,
  image: { src: `/placeholders/seller/${slug}.svg`, alt: `The ${name.toLowerCase()} at work` },
});

// Generic names (spec 13), not the old demo's sellers. Only verified sellers are featured. Each seller's badge is the
// one their listings show (shopping spec 6.1). The about texts and start months are sample wording.
export const sellers: readonly Seller[] = [
  seller(
    "hair-studio", "Hair studio", "Braids, cornrows and wash days on campus.", "hair-beauty", "midrand",
    { verified: true, badge: "trusted", since: "2025-02" },
    "I've been braiding since high school and started taking bookings on campus in my first year.\n" +
      "Bring a picture of the style you want, and I'll tell you how long it takes and which hair to buy.",
  ),
  seller(
    "maths-tutor", "Maths tutor", "Exam prep that sticks, one hour at a time.", "tutoring", "midrand",
    { verified: true, badge: "responsive", since: "2025-08" },
    "I'm a third-year student who tutors first-years in Statistics 1 and Maths 1. We work through past papers " +
      "together until the method sticks.",
  ),
  seller(
    "home-bakery", "Home bakery", "Cupcakes and cookie boxes for any occasion.", "food", "midrand",
    { verified: true, badge: "trusted", since: "2025-04" },
    "I bake at home in Midrand and bring orders to campus in the morning. Cupcakes, cookie boxes and birthday " +
      "cakes, with a day's notice.",
  ),
  seller(
    "design-studio", "Design studio", "Logos and posters for student hustles.", "services", "midrand",
    { verified: true, badge: "responsive", since: "2025-11" },
    "I study graphic design and make logos, posters and social media posts for student hustles. You get two rounds " +
      "of changes and the files in every size you need.",
  ),
  seller(
    "thrift-rack", "Thrift rack", "Pre-loved jackets and denim, washed and pressed.", "fashion-thrift", "pretoria",
    { verified: true, badge: "new-seller", since: "2026-09" },
    "I hunt the thrift shops for good jackets and denim, then wash and press everything before it's listed. New " +
      "stock most weeks.",
  ),
  seller(
    "code-coach", "Code coach", "Python and Java help before your practicals.", "tutoring", "pretoria",
    { verified: true, badge: "trusted", since: "2025-03" },
    "I'm in my final year of IT and help first- and second-years with Python and Java. Bring your practical and " +
      "we'll debug it together, step by step.",
  ),
  seller(
    "phone-fix", "Phone fix", "Cracked screens and batteries, same day.", "services", "bedfordview",
    { verified: true, badge: "responsive", since: "2025-06" },
    "I replace cracked screens and tired batteries on most Samsung and iPhone models. Most repairs are done the " +
      "same day.",
  ),
  seller(
    "nail-bar", "Nail bar", "Gel, acrylics and nail art between lectures.", "hair-beauty", "cape-town-tyger-valley",
    { verified: true, badge: "responsive", since: "2025-09" },
    "Gel, acrylics and nail art, done between lectures at Tyger Valley. Book a slot and send me a picture of what " +
      "you'd like.",
  ),
  seller(
    "study-notes", "Study notes", "Typed summaries for first-year modules.", "textbooks-notes", "online",
    { verified: true, badge: "responsive", since: "2025-05" },
    "I type up clear summaries for first-year modules and tutor spreadsheets over video. Everything comes as a " +
      "PDF, so you can study anywhere.",
  ),
  seller(
    "res-kitchen", "Res kitchen", "Home-cooked lunch boxes, ordered by 10am.", "food", "durban-umhlanga",
    { badge: "trusted", since: "2025-07" },
    "Home-cooked lunch boxes for students in res. Order by 10am and collect at lunchtime; the menu changes every " +
      "week.",
  ),
  // Every listing's seller is on the listing's campus (browse and listing spec 6.2). These sellers aren't verified,
  // so the Featured today draw doesn't change.
  seller(
    "tech-corner", "Tech corner", "Calculators, headsets and chargers, tested before you buy.", "tech", "midrand",
    { badge: "responsive", since: "2026-03" },
    "I test every calculator, headset and charger before I list it, so you know it works.\n" +
      "Ask me anything about a listing. I usually reply within the hour.",
  ),
  seller(
    "book-swap", "Book swap", "Last year's textbooks and notes at half the price.", "textbooks-notes", "midrand",
    { badge: "trusted", since: "2025-01" },
    "I sell last year's textbooks and notes at about half the bookshop price. If a book has notes in the margins, " +
      "the listing says so.",
  ),
  seller(
    "res-deals", "Res deals", "Fridges, lamps and curtains from students moving out.", "res-living", "midrand",
    { badge: "trusted", since: "2025-10" },
    "When students move out of res, I find their fridges, lamps and curtains a new home. Everything is cleaned and " +
      "checked before it's listed.",
  ),
  seller(
    "closet-clear-out", "Closet clear-out", "Good clothes that need a new home.", "fashion-thrift", "midrand",
    { badge: "new-seller", since: "2026-09" },
    "Clearing out clothes I don't wear any more. Everything is washed, and I'm happy to swap.",
  ),
  seller(
    "ticket-desk", "Ticket desk", "Spare tickets for events around campus.", "tickets-events", "midrand",
    { badge: null, since: "2026-07" },
    "Spare tickets for events around Midrand, sold at what I paid. I'll help you change the name on the booking.",
  ),
  seller(
    "res-essentials", "Res essentials", "Kettles, lamps and the bits every res room needs.", "res-living", "pretoria",
    { badge: "responsive", since: "2026-02" },
    "Kettles, lamps and the small things every res room needs. I'm on campus most days, so collecting is easy.",
  ),
  seller(
    "lash-lounge", "Lash lounge", "Classic and volume lashes by appointment.", "hair-beauty", "pretoria",
    { badge: "trusted", since: "2025-05" },
    "Classic and volume lash sets by appointment. I'm taking a short break, and bookings open again soon.",
  ),
  seller(
    "stationery-stop", "Stationery stop", "Paper, pens and highlighters in bundles.", "stationery", "pretoria",
    { badge: null, since: "2026-06" },
    "Paper, pens and highlighters in bundles, for less than buying them one at a time. I restock before every " +
      "exam season.",
  ),
  seller(
    "bookshelf", "Bookshelf", "Textbooks from finished modules.", "textbooks-notes", "bedfordview",
    { badge: "trusted", since: "2025-03" },
    "Textbooks from modules I've finished, kept in good condition. Ask if you need a book that isn't listed yet.",
  ),
  seller(
    "moving-out-sale", "Moving-out sale", "Everything from a res room, priced to go.", "res-living", "bedfordview",
    { badge: null, since: "2026-09" },
    "I'm moving out of res at the end of the term, so everything has to go. Free things go to whoever collects " +
      "first.",
  ),
  seller(
    "kitchen-kit", "Kitchen kit", "Ovens, kettles and pots for cooking in res.", "res-living", "bloemfontein",
    { badge: "trusted", since: "2025-08" },
    "Ovens, kettles and pots for cooking in res, tested and cleaned. I can hold an item for a day while you arrange " +
      "to collect it.",
  ),
  seller(
    "weekend-market", "Weekend market", "Bikes, cameras and things worth a second life.", "res-living",
    "cape-town-mowbray",
    { badge: "new-seller", since: "2026-08" },
    "Bikes, cameras and other things worth a second life, found at weekend markets around Cape Town.\n" +
      "I'm open to swaps.",
  ),
  seller(
    "accounting-tutor", "Accounting tutor", "Accounting 2 and 3, explained until it clicks.", "tutoring",
    "durban-umhlanga",
    { badge: "trusted", since: "2025-02" },
    "I tutor Accounting 2 and 3 and explain each step until it clicks. Two-hour sessions, with past-paper questions " +
      "to take home.",
  ),
  seller(
    "study-desk", "Study desk", "Calculators and stationery for exam season.", "stationery", "east-london",
    { badge: null, since: "2026-05" },
    "Calculators and stationery for exam season. Whatever I can't sell, I give away.",
  ),
  seller(
    "room-refresh", "Room refresh", "Curtains, rugs and cushions for a brighter res room.", "res-living",
    "nelson-mandela-bay",
    { badge: "new-seller", since: "2026-09" },
    "Curtains, rugs and cushions to make a res room feel like home. Most things are under R200.",
  ),
  seller(
    "sports-kit", "Sports kit", "Jerseys and gym gear, washed and ready.", "fashion-thrift", "potchefstroom",
    { badge: "responsive", since: "2025-12" },
    "Jerseys and gym gear from teams and players who've moved on. Everything is washed and ready to wear.",
  ),
  seller(
    "drawing-office", "Drawing office", "Drawing sets and scales for engineering students.", "stationery",
    "vanderbijlpark",
    { badge: "trusted", since: "2025-04" },
    "Drawing sets, scales and templates for engineering students, from someone who's finished with them. Every set " +
      "is complete.",
  ),
  seller(
    "cv-clinic", "CV clinic", "CVs and LinkedIn profiles that get replies.", "services", "online",
    { badge: "trusted", since: "2025-06" },
    "I rewrite CVs and LinkedIn profiles for students looking for internships and first jobs. We start with a short " +
      "video call about the jobs you want.",
  ),
  seller(
    "logo-lab", "Logo lab", "Logos for student brands, paid for or swapped.", "services", "online",
    { badge: null, since: "2026-08" },
    "Logos for student brands, paid for or swapped for something I need, like photos or a website. Tell me about " +
      "your brand and I'll send three ideas.",
  ),
];
