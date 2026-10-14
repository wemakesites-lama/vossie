import type { LookingForRequest, RequestStatus } from "@/lib/types";

type Ask = {
  categorySlug: string;
  /** Rand, or null for "open to offers". */
  budgetZar: number | null;
  swapWelcome?: boolean;
  /** YYYY-MM-DD in South African time. */
  neededBy?: string;
  /** ISO 8601 in UTC. */
  createdAt: string;
  status?: RequestStatus;
};

const request = (
  id: string,
  title: string,
  campusSlug: string,
  offers: number,
  { categorySlug, budgetZar, swapWelcome = false, neededBy, createdAt, status = "open" }: Ask,
  details: string,
): LookingForRequest => ({
  id,
  title,
  campusSlug,
  offers,
  details,
  categorySlug,
  budgetZar,
  swapWelcome,
  neededBy: neededBy ?? null,
  createdAt,
  status,
});

// Looking For requests, newest first (community spec 4.3). The first seven are the homepage's: their ids, titles,
// campuses and offers are as before, and they stay the newest, so the homepage shows what it did. Every campus but
// Mbombela has an open request, so Mbombela tests the empty state. Nothing open is in Tickets & events, so the board's
// empty category can be tested. Requests name no one (community spec decision 2). The wording is sample text.
export const requests: readonly LookingForRequest[] = [
  request(
    "r-001", "Accounting 1 tutor this week", "midrand", 2,
    { categorySlug: "tutoring", budgetZar: 300, neededBy: "2026-10-16", createdAt: "2026-10-13T07:30:00Z" },
    "I'm stuck on adjustments and the trial balance before Friday's test. Looking for someone who passed " +
      "Accounting 1 to work through two past papers with me.\nEvenings on campus suit me best.",
  ),
  request(
    "r-002", "Graphic calculator to borrow for exams", "pretoria", 1,
    {
      categorySlug: "tech", budgetZar: 100, swapWelcome: true, neededBy: "2026-10-26",
      createdAt: "2026-10-12T18:10:00Z",
    },
    "My calculator stopped working and exams start on the 26th. I'd like to borrow a graphic calculator for three " +
      "weeks. I can pay R100, or swap my Statistics 1 notes.",
  ),
  request(
    "r-003", "Birthday cake for Friday", "midrand", 3,
    { categorySlug: "food", budgetZar: 350, neededBy: "2026-10-16", createdAt: "2026-10-12T09:45:00Z" },
    "A chocolate cake for my roommate's birthday on Friday, big enough for ten people. Writing on top would be a " +
      "bonus. I can collect on campus at lunchtime.",
  ),
  request(
    "r-004", "Second-hand bar fridge", "bedfordview", 0,
    { categorySlug: "res-living", budgetZar: 1200, createdAt: "2026-10-11T15:20:00Z" },
    "Looking for a small bar fridge for my res room, in working order. I can collect anywhere near campus if you can " +
      "help me carry it.",
  ),
  request(
    "r-005", "Someone to fix my laptop hinge", "cape-town-mowbray", 1,
    { categorySlug: "services", budgetZar: null, neededBy: "2026-10-20", createdAt: "2026-10-11T08:05:00Z" },
    "The left hinge on my laptop cracked and the screen wobbles. I'd like it fixed rather than replaced. Open to " +
      "offers on price.",
  ),
  request(
    "r-006", "Lift to campus on Monday mornings", "pretoria", 2,
    // 22:40 UTC is 00:40 the next day in South Africa: the page says "Posted 11 Oct".
    { categorySlug: "services", budgetZar: 200, createdAt: "2026-10-10T22:40:00Z" },
    "I live about ten minutes from campus and have an 8am class every Monday. I'll put in R200 a month for petrol if " +
      "you drive past.\nIt's for the rest of the semester.",
  ),
  request(
    "r-007", "Business Law 2 notes", "online", 4,
    {
      categorySlug: "textbooks-notes", budgetZar: 150, swapWelcome: true, neededBy: "2026-10-30",
      createdAt: "2026-10-10T06:15:00Z",
    },
    "Looking for clear summary notes for Business Law 2, especially contracts. A PDF is fine. I can pay R150 or swap " +
      "my Business Management 2 notes.",
  ),
  request(
    "r-008", "Formal dress for a faculty dinner", "bloemfontein", 1,
    {
      categorySlug: "fashion-thrift", budgetZar: 400, swapWelcome: true, neededBy: "2026-10-24",
      createdAt: "2026-10-09T19:30:00Z",
    },
    "I need a long formal dress, size 34, for a faculty dinner on the 24th. Happy to buy, borrow or swap one of mine.",
  ),
  request(
    "r-009", "Desk chair that doesn't wobble", "cape-town-tyger-valley", 0,
    { categorySlug: "res-living", budgetZar: 300, createdAt: "2026-10-09T10:00:00Z" },
    "My res chair is falling apart. Looking for a sturdy desk chair, ideally one that adjusts. I can collect from " +
      "campus or nearby.",
  ),
  request(
    "r-010", "Catering for a society braai", "durban-umhlanga", 2,
    { categorySlug: "food", budgetZar: 1500, neededBy: "2026-10-31", createdAt: "2026-10-08T16:25:00Z" },
    "Our society is having a braai for about 20 people on the 31st. We need someone to do the meat and two salads; " +
      "we'll bring the drinks.",
  ),
  request(
    "r-011", "Drawing set for Engineering Graphics", "east-london", 1,
    { categorySlug: "stationery", budgetZar: 250, neededBy: "2026-10-19", createdAt: "2026-10-08T07:50:00Z" },
    "I need a full drawing set: compass, set squares and a scale ruler. Second-hand is fine as long as nothing is " +
      "missing.",
  ),
  request(
    "r-012", "Box braids before graduation", "nelson-mandela-bay", 3,
    { categorySlug: "hair-beauty", budgetZar: 450, neededBy: "2026-11-27", createdAt: "2026-10-07T13:35:00Z" },
    "Looking for someone to do medium box braids, waist length, the week before graduation. I'll buy the hair if you " +
      "tell me how many packs.",
  ),
  request(
    "r-013", "Laptop charger, Lenovo 65W", "potchefstroom", 0,
    { categorySlug: "tech", budgetZar: null, swapWelcome: true, createdAt: "2026-10-06T18:00:00Z" },
    "My laptop charger stopped working. I need a 65W Lenovo charger with a USB-C plug. Make me an offer, or I can " +
      "swap a pair of wired headphones.",
  ),
  request(
    "r-014", "Python help for my first practical", "vanderbijlpark", 1,
    { categorySlug: "tutoring", budgetZar: 200, neededBy: "2026-10-23", createdAt: "2026-10-06T09:20:00Z" },
    "My first Python practical is due on the 23rd and my loops keep breaking. Looking for an hour or two of help, " +
      "online or on campus.",
  ),
  request(
    "r-015", "Kettle for res", "midrand", 5,
    { categorySlug: "res-living", budgetZar: 150, createdAt: "2026-10-03T12:00:00Z", status: "closed" },
    "Looking for a working kettle for my res room. Collecting on campus is easiest.",
  ),
  request(
    "r-016", "Two tickets to the spring concert", "pretoria", 2,
    {
      categorySlug: "tickets-events", budgetZar: 300, neededBy: "2026-10-10",
      createdAt: "2026-09-29T08:30:00Z", status: "closed",
    },
    "Looking for two tickets to the spring concert on the 10th, at or below what you paid.",
  ),
];
