import type { Seller } from "@/lib/types";

const seller = (
  slug: string,
  name: string,
  tagline: string,
  category: string,
  campusSlug: string,
  verified = true,
): Seller => ({
  slug,
  name,
  tagline,
  category,
  campusSlug,
  verified,
  image: { src: `/placeholders/seller/${slug}.svg`, alt: `The ${name.toLowerCase()} at work` },
});

// Generic names (spec 13), not the old demo's sellers. Only verified sellers are featured.
export const sellers: readonly Seller[] = [
  seller("hair-studio", "Hair studio", "Braids, cornrows and wash days on campus.", "Hair & beauty", "midrand"),
  seller("maths-tutor", "Maths tutor", "Exam prep that sticks, one hour at a time.", "Tutoring", "midrand"),
  seller("home-bakery", "Home bakery", "Cupcakes and cookie boxes for any occasion.", "Food", "midrand"),
  seller("design-studio", "Design studio", "Logos and posters for student hustles.", "Services", "midrand"),
  seller("thrift-rack", "Thrift rack", "Pre-loved jackets and denim, washed and pressed.", "Fashion & thrift", "pretoria"),
  seller("code-coach", "Code coach", "Python and Java help before your practicals.", "Tutoring", "pretoria"),
  seller("phone-fix", "Phone fix", "Cracked screens and batteries, same day.", "Services", "bedfordview"),
  seller("nail-bar", "Nail bar", "Gel, acrylics and nail art between lectures.", "Hair & beauty", "cape-town-tyger-valley"),
  seller("study-notes", "Study notes", "Typed summaries for first-year modules.", "Textbooks & notes", "online"),
  seller("res-kitchen", "Res kitchen", "Home-cooked lunch boxes, ordered by 10am.", "Food", "durban-umhlanga", false),
  // Every listing's seller is on the listing's campus (browse and listing spec 6.2). These sellers aren't verified,
  // so the Featured today draw doesn't change.
  seller("tech-corner", "Tech corner", "Calculators, headsets and chargers, tested before you buy.", "Tech", "midrand", false),
  seller("book-swap", "Book swap", "Last year's textbooks and notes at half the price.", "Textbooks & notes", "midrand", false),
  seller("res-deals", "Res deals", "Fridges, lamps and curtains from students moving out.", "Res & living", "midrand", false),
  seller("closet-clear-out", "Closet clear-out", "Good clothes that need a new home.", "Fashion & thrift", "midrand", false),
  seller("ticket-desk", "Ticket desk", "Spare tickets for events around campus.", "Tickets & events", "midrand", false),
  seller("res-essentials", "Res essentials", "Kettles, lamps and the bits every res room needs.", "Res & living", "pretoria", false),
  seller("lash-lounge", "Lash lounge", "Classic and volume lashes by appointment.", "Hair & beauty", "pretoria", false),
  seller("stationery-stop", "Stationery stop", "Paper, pens and highlighters in bundles.", "Stationery", "pretoria", false),
  seller("bookshelf", "Bookshelf", "Textbooks from finished modules.", "Textbooks & notes", "bedfordview", false),
  seller("moving-out-sale", "Moving-out sale", "Everything from a res room, priced to go.", "Res & living", "bedfordview", false),
  seller("kitchen-kit", "Kitchen kit", "Ovens, kettles and pots for cooking in res.", "Res & living", "bloemfontein", false),
  seller("weekend-market", "Weekend market", "Bikes, cameras and things worth a second life.", "Res & living", "cape-town-mowbray", false),
  seller("accounting-tutor", "Accounting tutor", "Accounting 2 and 3, explained until it clicks.", "Tutoring", "durban-umhlanga", false),
  seller("study-desk", "Study desk", "Calculators and stationery for exam season.", "Stationery", "east-london", false),
  seller("room-refresh", "Room refresh", "Curtains, rugs and cushions for a brighter res room.", "Res & living", "nelson-mandela-bay", false),
  seller("sports-kit", "Sports kit", "Jerseys and gym gear, washed and ready.", "Fashion & thrift", "potchefstroom", false),
  seller("drawing-office", "Drawing office", "Drawing sets and scales for engineering students.", "Stationery", "vanderbijlpark", false),
  seller("cv-clinic", "CV clinic", "CVs and LinkedIn profiles that get replies.", "Services", "online", false),
  seller("logo-lab", "Logo lab", "Logos for student brands, paid for or swapped.", "Services", "online", false),
];
