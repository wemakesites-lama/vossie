import { describe, expect, it } from "vitest";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";
import {
  byNeed,
  caseloadDetail,
  caseloadSummary,
  checkInDue,
  checkInWords,
  csvCell,
  FLAG_WORDS,
  mentorCsv,
  mentorFlags,
  needsYou,
  repliesInTime,
  sharedMax,
  shopStanding,
  sparkSummary,
} from "./mentor";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
});

/** An open shop with two listings up, unless `more` says otherwise. */
const flags = (
  numbers: EnquiryCounts,
  more: Partial<{ status: "approved" | "paused"; pausedBy: "seller" | "staff" | null; availableListings: number }> = {},
) => mentorFlags({ counts: numbers, status: "approved", pausedBy: null, availableListings: 2, ...more });

const shop = (overrides: Partial<MentoredShop>): MentoredShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "approved",
  pausedBy: null,
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: counts(2, 2, 2, 0),
  flags: [],
  lastCheckInOn: "2026-10-06",
  ...overrides,
});

const TODAY = "2026-10-14";

describe("the mentor dashboard's flags (staff tools spec 2.6; role views spec 7.3)", () => {
  it("flags a shop with no enquiries in the 14 days", () => {
    expect(flags(counts(0, 0, 0, 0))).toEqual(["no-enquiries"]);
    expect(flags(counts(1, 0, 0, 0))).toEqual([]);
  });

  it("says No listings yet instead of No enquiries when nothing is up for buyers", () => {
    expect(flags(counts(0, 0, 0, 0), { availableListings: 0 })).toEqual(["no-listings"]);
    // Sold out: enquiries came, but there's nothing left to ask about.
    expect(flags(counts(3, 0, 0, 0), { availableListings: 0 })).toEqual(["no-listings"]);
  });

  it("flags slow replies under 50%, only once an enquiry is due", () => {
    expect(flags(counts(4, 4, 1, 0))).toEqual(["slow-replies"]);
    expect(flags(counts(4, 4, 2, 0))).toEqual([]);
    expect(flags(counts(2, 0, 0, 0))).toEqual([]);
  });

  it("says whose pause it is, after the other flags", () => {
    expect(flags(counts(0, 0, 0, 0), { status: "paused", pausedBy: "staff" })).toEqual(["no-enquiries", "paused-by-hub"]);
    expect(flags(counts(1, 0, 0, 0), { status: "paused", pausedBy: "seller" })).toEqual(["paused-by-seller"]);
    // An old sample row has no pausedBy: the seller's own pause.
    expect(flags(counts(1, 0, 0, 0), { status: "paused", pausedBy: null })).toEqual(["paused-by-seller"]);
  });

  it("names each flag, with what it means in a sentence", () => {
    expect(Object.values(FLAG_WORDS).map((words) => words.label)).toEqual([
      "No listings yet",
      "No enquiries in 14 days",
      "Slow replies (under 50% in 48 hours)",
      "Paused by the Hub",
      "Paused by the seller",
    ]);
    for (const words of Object.values(FLAG_WORDS)) expect(words.explanation).toMatch(/\.$/);
  });

  it("says replies in time as the dashboard does (selling plan decision 18)", () => {
    expect(repliesInTime(counts(4, 4, 3, 0))).toBe("3 of 4");
    expect(repliesInTime(counts(2, 0, 0, 0))).toBe("None due yet");
  });

  it("says where a shop stands, a pause with whose it is", () => {
    expect(shopStanding("approved", null)).toBe("Open");
    expect(shopStanding("paused", "staff")).toBe("Paused by the Hub");
    expect(shopStanding("paused", "seller")).toBe("Paused by the seller");
    expect(shopStanding("pending", null)).toBe("Waiting");
  });
});

describe("check-ins (role views spec 7.3, N4 plan decision 5)", () => {
  it("is due with none yet, or more than 30 days after the last", () => {
    expect(checkInDue(null, TODAY)).toBe(true);
    expect(checkInDue("2026-09-14", TODAY)).toBe(false);
    expect(checkInDue("2026-09-13", TODAY)).toBe(true);
  });

  it("says how long ago, or Due", () => {
    expect(checkInWords(null, TODAY)).toBe("Due");
    expect(checkInWords("2026-10-14", TODAY)).toBe("Today");
    expect(checkInWords("2026-10-13", TODAY)).toBe("1 day ago");
    expect(checkInWords("2026-10-05", TODAY)).toBe("9 days ago");
    expect(checkInWords("2026-09-13", TODAY)).toBe("Due");
  });

  it("needs you with a flag or a check-in due", () => {
    expect(needsYou(shop({}), TODAY)).toBe(false);
    expect(needsYou(shop({ flags: ["slow-replies"] }), TODAY)).toBe(true);
    expect(needsYou(shop({ lastCheckInOn: null }), TODAY)).toBe(true);
  });
});

describe("the caseload's order (role views spec 6)", () => {
  it("puts the most flags first, then the longest without a check-in (none first), then the name", () => {
    const rows = [
      shop({ name: "Zed", flags: ["slow-replies"], lastCheckInOn: "2026-10-12" }),
      shop({ name: "Two flags", flags: ["no-enquiries", "paused-by-seller"], lastCheckInOn: "2026-10-14" }),
      shop({ name: "Bee", flags: ["slow-replies"], lastCheckInOn: null }),
      shop({ name: "Ace", flags: ["slow-replies"], lastCheckInOn: null }),
      shop({ name: "Calm", flags: [], lastCheckInOn: null }),
    ];
    expect(rows.sort(byNeed(TODAY)).map((row) => row.name)).toEqual(["Two flags", "Ace", "Bee", "Zed", "Calm"]);
  });
});

describe("the caseload's words (role views spec 7.3)", () => {
  it("sums up who needs you and the slot requests waiting", () => {
    expect(caseloadSummary(2, 6, 2)).toBe("2 of 6 need you · 2 slot requests");
    expect(caseloadSummary(1, 1, 1)).toBe("1 of 1 need you · 1 slot request");
    expect(caseloadSummary(0, 3, 0)).toBe("0 of 3 need you · 0 slot requests");
    expect(caseloadSummary(0, 3, null)).toBe("0 of 3 need you");
  });

  it("explains a row's flags in sentences, and names the mentor for an admin", () => {
    expect(caseloadDetail(shop({ flags: ["no-listings"] }), false)).toBe(FLAG_WORDS["no-listings"].explanation);
    expect(caseloadDetail(shop({ flags: ["no-enquiries", "paused-by-hub"] }), false)).toBe(
      `${FLAG_WORDS["no-enquiries"].explanation} ${FLAG_WORDS["paused-by-hub"].explanation}`,
    );
    expect(caseloadDetail(shop({}), false)).toBe("No flags.");
    expect(caseloadDetail(shop({}), true)).toBe("Mentor: Naledi. No flags.");
  });

  it("takes the largest day across every shop as the chart's shared scale", () => {
    expect(sharedMax([[1, null, 4], [2]])).toBe(4);
    expect(sharedMax([[null]])).toBe(0);
    expect(sharedMax([])).toBe(0);
  });

  it("says each little chart's takeaway", () => {
    expect(sparkSummary("Tech corner", [null, null, 1, 0, 3])).toBe("Tech corner: 4 enquiries in 3 days, 3 today.");
    expect(sparkSummary("Tech corner", [0, 1])).toBe("Tech corner: 1 enquiry in 2 days, 1 today.");
    expect(sparkSummary("Tech corner", [null, null])).toBe("Tech corner: no days to show yet.");
  });
});

describe("the dashboard's CSV (staff tools spec 2.6, plan decision 17, amendment 12.1 and 12.2)", () => {
  it("quotes every text cell, doubling its quotes, and leaves numbers bare", () => {
    expect(csvCell("Tech corner")).toBe('"Tech corner"');
    expect(csvCell("Bakes, cakes")).toBe('"Bakes, cakes"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("Two\nlines")).toBe('"Two\nlines"');
    expect(csvCell("")).toBe('""');
    expect(csvCell(3)).toBe("3");
  });

  it("puts an apostrophe before text a spreadsheet would run as a formula, and quotes it", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("\"'=HYPERLINK(1)\"");
    expect(csvCell("+27 11")).toBe("\"'+27 11\"");
    expect(csvCell("-shop")).toBe("\"'-shop\"");
    expect(csvCell("@me")).toBe("\"'@me\"");
    expect(csvCell("=1,2")).toBe("\"'=1,2\"");
    expect(csvCell("\t=1")).toBe("\"'\t=1\"");
    expect(csvCell("\r=1")).toBe("\"'\r=1\"");
  });

  it("keeps a semicolon inside its quotes, so a spreadsheet that splits on semicolons can't run what follows it", () => {
    expect(csvCell("Bakes;=1+1;")).toBe('"Bakes;=1+1;"');
    expect(csvCell("Rock-n-roll = fun")).toBe('"Rock-n-roll = fun"');
  });

  it("writes the table with a header row and a line per shop, the flags in the new words, each line ending in CRLF", () => {
    const row = shop({
      status: "paused",
      pausedBy: "seller",
      counts: counts(4, 4, 1, 2),
      flags: ["slow-replies", "paused-by-seller"],
    });
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toBe(
      '\uFEFF"Shop","Campus","Mentor","Badge","Status","Enquiries (14 days)","Due for a reply","Replied within 48 hours",' +
        '"Sales confirmed (14 days)","Flags"\r\n' +
        '"Tech corner","Midrand","Naledi","Responsive","Paused",4,4,1,2,"Slow replies (under 50% in 48 hours); Paused by the seller"\r\n',
    );
    expect(mentorCsv([], new Map())).toMatch(/^\uFEFF"Shop",.*,"Flags"\r\n$/);
  });

  it("quotes a shop with no badge or flags as empty text, and guards a shop named like a formula", () => {
    const row = shop({ slug: "bakes", name: "=Bakes;=1+1;", campusSlug: "online", badge: null, counts: counts(0, 0, 0, 0) });
    const lines = mentorCsv([row], new Map()).split("\r\n");
    expect(lines[1]).toBe("\"'=Bakes;=1+1;\",\"online\",\"Naledi\",\"\",\"Open\",0,0,0,0,\"\"");
  });

  it("starts with a UTF-8 byte-order mark, so Excel reads accents and apostrophes right (Zoë's Café)", () => {
    const csv = mentorCsv([], new Map());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv[1]).toBe('"');
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const row = shop({ slug: "zoes", name: "Zoë's Café", badge: null, counts: counts(1, 0, 0, 0) });
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toContain('"Zoë\'s Café","Midrand"');
  });
});
