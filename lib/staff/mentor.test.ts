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
    // A tab or a carriage return can start a formula in some spreadsheets, so they get the apostrophe too.
    expect(csvCell("\t=1")).toBe("\"'\t=1\"");
    expect(csvCell("\r=1")).toBe("\"'\r=1\"");
  });

  it("keeps a semicolon inside its quotes, so a spreadsheet that splits on semicolons can't run what follows it", () => {
    // Where Excel's list separator is a semicolon, an unquoted `Bakes;=1+1;` would become three cells, the second a formula.
    expect(csvCell("Bakes;=1+1;")).toBe('"Bakes;=1+1;"');
    // Only the start of the cell is guarded: a name that merely contains a trigger character is left as typed.
    expect(csvCell("Rock-n-roll = fun")).toBe('"Rock-n-roll = fun"');
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
      pausedBy: null,
      mentorId: "acc-mentor",
      mentorName: "Naledi",
      counts: counts(4, 4, 1, 2),
      flags: ["slow-replies", "paused"],
    };
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toBe(
      '\uFEFF"Shop","Campus","Mentor","Badge","Status","Enquiries (14 days)","Due for a reply","Replied within 48 hours",' +
        '"Sales confirmed (14 days)","Flags"\r\n' +
        '"Tech corner","Midrand","Naledi","Responsive","Paused",4,4,1,2,"Slow replies (under 50% in 48 hours); Shop paused"\r\n',
    );
    expect(mentorCsv([], new Map())).toMatch(/^\uFEFF"Shop",.*,"Flags"\r\n$/);
  });

  it("quotes a shop with no badge or flags as empty text, and guards a shop named like a formula", () => {
    const row: MentoredShop = {
      slug: "bakes",
      name: "=Bakes;=1+1;",
      campusSlug: "online",
      ownerName: "Thandi",
      ownerId: "acc-buyer",
      badge: null,
      status: "approved",
      pausedBy: null,
      mentorId: "acc-mentor",
      mentorName: "Naledi",
      counts: counts(0, 0, 0, 0),
      flags: [],
    };
    const lines = mentorCsv([row], new Map()).split("\r\n");
    expect(lines[1]).toBe("\"'=Bakes;=1+1;\",\"online\",\"Naledi\",\"\",\"Open\",0,0,0,0,\"\"");
  });

  it("starts with a UTF-8 byte-order mark, so Excel reads accents and apostrophes right (Zoë's Café)", () => {
    const csv = mentorCsv([], new Map());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv[1]).toBe('"');
    expect(Buffer.from(csv).subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    const row: MentoredShop = {
      slug: "zoes",
      name: "Zoë's Café",
      campusSlug: "midrand",
      ownerName: "Zoë",
      ownerId: "acc-zoe",
      badge: null,
      status: "approved",
      pausedBy: null,
      mentorId: "acc-mentor",
      mentorName: "Naledi",
      counts: counts(1, 0, 0, 0),
      flags: [],
    };
    expect(mentorCsv([row], new Map([["midrand", "Midrand"]]))).toContain('"Zoë\'s Café","Midrand"');
  });
});
