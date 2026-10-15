import { describe, expect, it } from "vitest";
import type { EnquiryCounts, MentoredShop } from "@/lib/types";
import { csvCell, FLAG_WORDS, mentorCsv, mentorFlags, repliesInTime } from "./mentor";

const counts = (enquiries: number, due: number, repliedInTime: number, salesConfirmed: number): EnquiryCounts => ({
  enquiries,
  due,
  repliedInTime,
  salesConfirmed,
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
});

describe("the dashboard's CSV (staff tools spec 2.6, plan decision 17)", () => {
  it("quotes a cell with a comma, a quote or a line break, doubling its quotes", () => {
    expect(csvCell("Bakes, cakes")).toBe('"Bakes, cakes"');
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

  it("writes the table with a header row and a line per shop, ending each line with CRLF", () => {
    const row: MentoredShop = {
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
    };
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toBe(
      "Shop,Campus,Mentor,Badge,Status,Enquiries (14 days),Due for a reply,Replied within 48 hours," +
        "Sales confirmed (14 days),Flags\r\n" +
        "Tech corner,Midrand,Naledi,Responsive,Paused,4,4,1,2,Slow replies (under 50% in 48 hours); Shop paused\r\n",
    );
    expect(mentorCsv([], new Map())).toMatch(/^Shop,.*,Flags\r\n$/);
  });
});
