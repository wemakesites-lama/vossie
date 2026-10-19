import { describe, expect, it } from "vitest";
import { addDays, checkNeededBy, checkRequest, hasContactDetails, parseBudget, type RequestInput } from "./rules";

const KNOWN = { categorySlugs: ["tutoring", "tech"], campusSlugs: ["midrand", "online"], today: "2026-10-14" };

const input = (overrides: Partial<RequestInput> = {}): RequestInput => ({
  title: "Accounting 1 tutor this week",
  categorySlug: "tutoring",
  campusSlug: "midrand",
  details: "Stuck on adjustments before Friday's test.\nEvenings suit me.",
  budget: "300",
  swap: false,
  neededBy: "2026-10-16",
  ...overrides,
});

describe("contact details (community actions spec 2.4, plan decision 3)", () => {
  it("finds phone numbers however they're written", () => {
    for (const text of [
      "Call 0821234567",
      "WhatsApp 082 123 4567",
      "082-123-4567 after six",
      "Ring (012) 345 6789",
      "+27 82 123 4567",
      "0027821234567",
      "R300 0821234567",
      "0 8 2 1 2 3 4 5 6 7",
    ]) {
      expect(hasContactDetails(text), text).toBe(true);
    }
  });

  it("finds email addresses", () => {
    expect(hasContactDetails("Mail sipho.m@gmail.com")).toBe(true);
    expect(hasContactDetails("student@eduvos.com please")).toBe(true);
  });

  it("lets ISBNs, prices, dates and plain numbers through", () => {
    for (const text of [
      "ISBN 0-306-40615-2",
      "ISBN: 0306406152",
      "0-306-40615-2",
      "978-0-306-40615-7",
      "9780306406157",
      "978 0 306 40615 7",
      "Budget R1 200 by 2026-10-16",
      "Two past papers, 2024 and 2025",
      "Room 12, block 3, from 18:00",
    ]) {
      expect(hasContactDetails(text), text).toBe(false);
    }
  });

  it("doesn't take a phone number for an ISBN because it's labelled one", () => {
    expect(hasContactDetails("ISBN 0821234567")).toBe(true);
  });
});

describe("the budget (community actions plan decision 5)", () => {
  it("reads whole rand, with or without R, spaces and commas; empty is open to offers", () => {
    expect(parseBudget("300")).toBe(300);
    expect(parseBudget(" R1 200 ")).toBe(1200);
    expect(parseBudget("r1,200")).toBe(1200);
    expect(parseBudget("100000")).toBe(100000);
    expect(parseBudget("")).toBeNull();
    expect(parseBudget("  ")).toBeNull();
  });

  it("refuses anything else", () => {
    for (const raw of ["0", "100001", "12.50", "about 300", "-5", "R"]) {
      expect(parseBudget(raw), raw).toBe(raw === "R" ? null : "invalid");
    }
  });
});

describe("needed by (community actions spec 2.3)", () => {
  it("adds days to a South African date without the clock", () => {
    expect(addDays("2026-10-14", 90)).toBe("2027-01-12");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("is empty, or today to 90 days on", () => {
    expect(checkNeededBy("", "2026-10-14")).toEqual({ value: null, error: null });
    expect(checkNeededBy("2026-10-14", "2026-10-14")).toEqual({ value: "2026-10-14", error: null });
    expect(checkNeededBy("2027-01-12", "2026-10-14")).toEqual({ value: "2027-01-12", error: null });
    expect(checkNeededBy("2027-01-13", "2026-10-14").error).toBe("needed-far");
    expect(checkNeededBy("2026-10-13", "2026-10-14").error).toBe("needed-past");
  });

  it("refuses what isn't a real date", () => {
    for (const raw of ["16 Oct", "2026-02-30", "2026-13-01", "tomorrow"]) {
      expect(checkNeededBy(raw, "2026-10-14").error, raw).toBe("needed-invalid");
    }
  });
});

describe("the request form's checks (community actions spec 2.3)", () => {
  it("gives the fields back cleaned: one-line title, details' line breaks kept, the budget in rand", () => {
    expect(
      checkRequest(input({ title: "  Accounting 1\n tutor   this week ", details: " A\r\nB is what I need, please. " }), KNOWN),
    ).toEqual({
      value: {
        title: "Accounting 1 tutor this week",
        categorySlug: "tutoring",
        campusSlug: "midrand",
        details: "A\nB is what I need, please.",
        budgetZar: 300,
        swapWelcome: false,
        neededBy: "2026-10-16",
      },
      errors: [],
    });
  });

  it("takes an empty budget and no date as open to offers, any time", () => {
    expect(checkRequest(input({ budget: "", neededBy: "", swap: true }), KNOWN).value).toMatchObject({
      budgetZar: null,
      neededBy: null,
      swapWelcome: true,
    });
  });

  it("lists every problem in the form's order", () => {
    expect(
      checkRequest(
        { title: "", categorySlug: "", campusSlug: "mars", details: "", budget: "lots", swap: false, neededBy: "soon" },
        KNOWN,
      ),
    ).toEqual({
      value: null,
      errors: ["title-missing", "category-missing", "campus-missing", "details-missing", "budget-invalid", "needed-invalid"],
    });
  });

  it("checks the lengths: a title of 5 to 70, details of 20 to 600", () => {
    expect(checkRequest(input({ title: "Desk" }), KNOWN).errors).toEqual(["title-length"]);
    expect(checkRequest(input({ title: "x".repeat(71) }), KNOWN).errors).toEqual(["title-length"]);
    expect(checkRequest(input({ title: "x".repeat(70) }), KNOWN).errors).toEqual([]);
    expect(checkRequest(input({ details: "Too short." }), KNOWN).errors).toEqual(["details-length"]);
    expect(checkRequest(input({ details: "x".repeat(601) }), KNOWN).errors).toEqual(["details-length"]);
  });

  it("refuses contact details in the title or the details (spec 2.4)", () => {
    expect(checkRequest(input({ title: "Tutor, call 0821234567" }), KNOWN).errors).toEqual(["title-contact"]);
    expect(checkRequest(input({ details: "Email me at thandi@gmail.com about it." }), KNOWN).errors).toEqual([
      "details-contact",
    ]);
    expect(checkRequest(input({ details: "The textbook is ISBN 978-0-306-40615-7, any edition." }), KNOWN).errors).toEqual(
      [],
    );
  });
});
