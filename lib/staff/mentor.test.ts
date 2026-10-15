import { describe, expect, it } from "vitest";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";
import { CSV_BOM, csvCell, FLAG_WORDS, mentorCsv, mentorFlags, repliesInTime, statusWords } from "./mentor";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
});

const shop = (overrides: Partial<MentoredShop> = {}): MentoredShop => ({
  slug: "tech-corner",
  name: "Tech corner",
  campusSlug: "midrand",
  ownerName: "Sipho",
  ownerId: "acc-seller",
  badge: "responsive",
  status: "paused",
  mentorId: "acc-mentor",
  mentorName: "Naledi",
  counts: counts(4, 4, 1, 2),
  flags: ["slow-replies", "paused"],
  ...overrides,
});

describe("the mentor dashboard's flags (staff tools spec 2.6, plan decision 15)", () => {
  it("flags a shop with no enquiries in the 14 days", () => {
    expect(mentorFlags(counts(0, 0, 0, 0), "approved")).toEqual(["no-enquiries"]);
    expect(mentorFlags(counts(1, 0, 0, 0), "approved")).toEqual([]);
  });

  it("flags slow replies under 50%, only once an enquiry is due", () => {
    expect(mentorFlags(counts(4, 4, 1, 0), "approved")).toEqual(["slow-replies"]);
    expect(mentorFlags(counts(4, 4, 2, 0), "approved")).toEqual([]);
    expect(mentorFlags(counts(2, 0, 0, 0), "approved")).toEqual([]);
  });

  it("flags a paused shop, after the others", () => {
    expect(mentorFlags(counts(0, 0, 0, 0), "paused")).toEqual(["no-enquiries", "paused"]);
  });

  it("names each flag in the spec's words, with what it means", () => {
    expect(Object.values(FLAG_WORDS).map((words) => words.label)).toEqual([
      "No enquiries in 14 days",
      "Slow replies (under 50% in 48 hours)",
      "Shop paused",
    ]);
    for (const words of Object.values(FLAG_WORDS)) expect(words.explanation).toMatch(/\.$/);
  });

  it("says replies in time as the dashboard does (selling plan decision 18)", () => {
    expect(repliesInTime(counts(4, 4, 3, 0))).toBe("3 of 4");
    expect(repliesInTime(counts(2, 0, 0, 0))).toBe("None due yet");
  });

  it("words a shop's status", () => {
    expect(["pending", "approved", "paused"].map((status) => statusWords(status as MentoredShop["status"]))).toEqual([
      "Waiting",
      "Open",
      "Paused",
    ]);
  });
});

describe("the dashboard's CSV (staff tools spec 2.6, plan decision 17, amendment 29)", () => {
  it("quotes a cell with a comma, a quote or a line break, doubling its quotes", () => {
    expect(csvCell("Bakes, cakes")).toBe('"Bakes, cakes"');
    // Where ";" splits cells (Excel in many locales), each part is checked too, and the cell is quoted.
    expect(csvCell("x;=1+1;")).toBe(`"x;'=1+1;"`);
    expect(csvCell("y;=cmd|' /C calc'!A0;")).toBe(`"y;'=cmd|' /C calc'!A0;"`);
    expect(csvCell("Bakes; cakes")).toBe('"Bakes; cakes"');
    // Full-width forms and leading spaces don't hide a formula.
    expect(csvCell("\uFF1D1+1")).toBe("'\uFF1D1+1");
    expect(csvCell(" =1+1")).toBe("' =1+1");
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell("Two\nlines")).toBe('"Two\nlines"');
    expect(csvCell("Tech corner")).toBe("Tech corner");
    expect(csvCell(3)).toBe("3");
  });

  it("puts an apostrophe before text a spreadsheet would run as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+27 11")).toBe("'+27 11");
    expect(csvCell("-shop")).toBe("'-shop");
    expect(csvCell("@me")).toBe("'@me");
    expect(csvCell("=1,2")).toBe("\"'=1,2\"");
  });

  it("does the same for text that starts with a tab or a carriage return (amendment 29)", () => {
    expect(csvCell("\t=1+1")).toBe("'\t=1+1");
    expect(csvCell("\r=1+1")).toBe("\"'\r=1+1\"");
  });

  it("neutralises a formula and quotes it in the same cell", () => {
    expect(csvCell('=HYPERLINK("http://x","Click")')).toBe('"\'=HYPERLINK(""http://x"",""Click"")"');
  });

  it("leaves a formula character that isn't first alone, and a number as it is", () => {
    expect(csvCell("Shop = best")).toBe("Shop = best");
    expect(csvCell("a@b")).toBe("a@b");
    expect(csvCell(0)).toBe("0");
  });

  it("starts with a UTF-8 byte order mark, so a spreadsheet reads accents and emoji right (amendment 29)", () => {
    expect(CSV_BOM).toBe("\uFEFF");
    expect(mentorCsv([], new Map()).startsWith(CSV_BOM)).toBe(true);
    expect([...new TextEncoder().encode(mentorCsv([], new Map())).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("writes the table with a header row and a line per shop, ending each line with CRLF", () => {
    expect(mentorCsv([shop()], new Map([["midrand", "Midrand"]]))).toBe(
      CSV_BOM +
        "Shop,Campus,Mentor,Badge,Status,Enquiries (14 days),Due for a reply,Replied within 48 hours," +
        "Sales confirmed (14 days),Flags\r\n" +
        'Tech corner,Midrand,Naledi,Responsive,Paused,4,4,1,2,"Slow replies (under 50% in 48 hours); Shop paused"\r\n',
    );
    expect(mentorCsv([], new Map())).toMatch(/^\uFEFFShop,.*,Flags\r\n$/);
  });

  it("neutralises a shop's and a mentor's name, falls back to the campus's slug, and leaves a missing badge empty", () => {
    const csv = mentorCsv(
      [shop({ name: "=cmd|' /C calc'!A0", mentorName: "@Naledi", campusSlug: "atlantis", badge: null, flags: [] })],
      new Map(),
    );
    expect(csv.split("\r\n")[1]).toBe("'=cmd|' /C calc'!A0,atlantis,'@Naledi,,Paused,4,4,1,2,");
  });
});
