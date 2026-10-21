import { describe, expect, it } from "vitest";
import {
  addDays,
  checkNeededBy,
  checkRequest,
  closedAtFor,
  closeReasonOf,
  closingDay,
  hasContactDetails,
  IDLE_CLOSE_DAYS,
  NEEDED_BY_GRACE_DAYS,
  parseBudget,
  REMINDER_DAYS_BEFORE,
  reminderDay,
  reminderDue,
  requestOpenOn,
  type RequestInput,
} from "./rules";

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

  // Staff review of Tasks 1 to 5 (plan amendment 17.2): numbers joined by a dash or slash, or after a dot, are still numbers.
  it("finds phone numbers joined to other numbers or text by a dash, a slash or a dot", () => {
    for (const text of [
      "082 123 4567-083 123 4567",
      "R300-0821234567",
      "Price 1.082 123 4567",
      "082/123/4567",
    ]) {
      expect(hasContactDetails(text), text).toBe(true);
    }
  });

  // Review of Tasks 6 to 15 (plan amendment 19.1): a comma, an underscore or a colon between digits joins them too.
  it("finds phone numbers split by commas, underscores or colons", () => {
    for (const text of ["082,123,4567", "082_123_4567", "082:123:4567", "Call 082, 123, 4567 after six", "R300,0821234567"]) {
      expect(hasContactDetails(text), text).toBe(true);
    }
  });

  it("lets prices, ranges and times with commas and colons through", () => {
    for (const text of ["R1,200", "1,200 - 2,000", "R1,200 - R2,000", "Room 12, block 3, from 18:00", "Tuesdays 17:30, 18:00"]) {
      expect(hasContactDetails(text), text).toBe(false);
    }
  });

  it("lets dates and ranges of dates or prices through, in both of the ways they are written", () => {
    for (const text of ["2026-10-01 - 2026-10-05", "01.10.2026 - 05.10.2026", "R1 200 - R2 000"]) {
      expect(hasContactDetails(text), text).toBe(false);
    }
  });

  it("still finds a phone number next to a date", () => {
    expect(hasContactDetails("Needed by 2026-10-16, call 082 123 4567")).toBe(true);
    expect(hasContactDetails("082 123 4567 on 01.10.2026")).toBe(true);
  });

  it("reads ISBN 10 and ISBN-10 as labels", () => {
    for (const text of ["ISBN 10: 0306406152", "ISBN-10 0306406152", "ISBN 10 0-306-40615-2", "isbn10: 0306406152"]) {
      expect(hasContactDetails(text), text).toBe(false);
    }
    expect(hasContactDetails("ISBN 10: 0821234567")).toBe(true);
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

  // Plan amendment 17.1: the same reading of money as a listing's price (parsePrice), so cents are never rand.
  it("reads South African money: ,00 or .00 cents are dropped, any other cents are refused", () => {
    expect(parseBudget("R250,00")).toBe(250);
    expect(parseBudget("250.00")).toBe(250);
    expect(parseBudget("R1 200,00")).toBe(1200);
    expect(parseBudget("1,200")).toBe(1200);
    for (const raw of ["99,99", "1,2", "R99,99", "1,20", "R250,50", "R0,00"]) {
      expect(parseBudget(raw), raw).toBe("invalid");
    }
  });

  it("checks the range after reading the money", () => {
    expect(parseBudget("R100 000,00")).toBe(100000);
    expect(parseBudget("R100 001,00")).toBe("invalid");
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

  // Review of Tasks 6 to 15 (plan amendment 19.6): editing a request after its date has gone by must not turn it away.
  it("accepts the date a request already holds after it has passed; only a changed date must be today or later", () => {
    expect(checkNeededBy("2026-10-10", "2026-10-14", "2026-10-10")).toEqual({ value: "2026-10-10", error: null });
    expect(checkNeededBy("2026-10-11", "2026-10-14", "2026-10-10").error).toBe("needed-past");
    expect(checkNeededBy("2026-10-10", "2026-10-14", null).error).toBe("needed-past");
    expect(checkNeededBy("2026-10-10", "2026-10-14").error).toBe("needed-past");
    expect(checkNeededBy("2026-10-20", "2026-10-14", "2026-10-10")).toEqual({ value: "2026-10-20", error: null });
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

  it("keeps a passed needed-by date unchanged when the request is being edited (plan amendment 19.6)", () => {
    const edited = input({ neededBy: "2026-10-10" });
    expect(checkRequest(edited, KNOWN).errors).toEqual(["needed-past"]);
    expect(checkRequest(edited, { ...KNOWN, keptNeededBy: "2026-10-10" })).toMatchObject({
      value: { neededBy: "2026-10-10" },
      errors: [],
    });
    expect(checkRequest(input({ neededBy: "2026-10-11" }), { ...KNOWN, keptNeededBy: "2026-10-10" }).errors).toEqual([
      "needed-past",
    ]);
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

describe("when a request closes itself (stage L spec decisions 8 to 10)", () => {
  const ROW = { askerId: "acc-student", neededBy: null, updatedAt: "2026-10-13T09:30:00.000Z" };

  it("keeps a request 3 whole days after its needed-by date, or 30 days after it last changed", () => {
    expect([NEEDED_BY_GRACE_DAYS, IDLE_CLOSE_DAYS]).toEqual([3, 30]);
    // Needed by Friday 16 October: open through Monday 19, closed from Tuesday 20.
    expect(closingDay({ ...ROW, neededBy: "2026-10-16" })).toBe("2026-10-20");
    // Posted 13 October: closed from 12 November.
    expect(closingDay(ROW)).toBe("2026-11-12");
  });

  it("counts the 30 days from the South African date: 22:30 UTC on 13 October is the 14th there", () => {
    expect(closingDay({ ...ROW, updatedAt: "2026-10-13T22:30:00.000Z" })).toBe("2026-11-13");
  });

  it("starts the 30 days again when the request changes, and lets a needed-by date win even when it's later", () => {
    expect(closingDay({ ...ROW, updatedAt: "2026-10-20T08:00:00.000Z" })).toBe("2026-11-19");
    expect(closingDay({ ...ROW, neededBy: "2027-01-10" })).toBe("2027-01-14");
  });

  it("never closes a sample request, which has no asker (decision 9)", () => {
    expect(closingDay({ ...ROW, askerId: null, neededBy: "2026-10-16" })).toBeNull();
    expect(closingDay({ ...ROW, askerId: null })).toBeNull();
  });

  it("is open the day before its closing day, and closed on it and after", () => {
    const request = { status: "open" as const, closesOn: "2026-10-20" };
    expect(requestOpenOn(request, "2026-10-19")).toBe(true);
    expect(requestOpenOn(request, "2026-10-20")).toBe(false);
    expect(requestOpenOn(request, "2026-10-21")).toBe(false);
    expect(requestOpenOn({ status: "open", closesOn: null }, "2030-01-01")).toBe(true);
    expect(requestOpenOn({ status: "closed", closesOn: null }, "2026-10-14")).toBe(false);
  });

  it("stores the close at the start of the closing day in South Africa, as UTC", () => {
    expect(closedAtFor("2026-10-20")).toBe("2026-10-19T22:00:00.000Z");
  });

  it("says why: its needed-by date, else the 30 days", () => {
    expect(closeReasonOf({ neededBy: "2026-10-16" })).toBe("needed-by");
    expect(closeReasonOf({ neededBy: null })).toBe("idle");
  });

  it("crosses the year in South African dates", () => {
    expect(closingDay({ ...ROW, neededBy: "2026-12-30" })).toBe("2027-01-03");
    expect(closingDay({ ...ROW, updatedAt: "2026-12-15T22:30:00.000Z" })).toBe("2027-01-15");
    expect(closedAtFor("2027-01-01")).toBe("2026-12-31T22:00:00.000Z");
  });
});

describe("the reminder before a request closes itself (stage M spec decisions 13 to 16)", () => {
  // Needed by Friday 16 October: closed from Tuesday 20, reminded from Sunday 18.
  const ROW = {
    askerId: "acc-student",
    neededBy: "2026-10-16",
    updatedAt: "2026-10-13T09:30:00.000Z",
    status: "open" as const,
    hiddenAt: null,
    remindedFor: null,
  };

  it("is due from two days before the closing day, in South African dates", () => {
    expect(REMINDER_DAYS_BEFORE).toBe(2);
    expect(reminderDay("2026-10-20")).toBe("2026-10-18");
    // Posted 13 October with no date: closed from 12 November, reminded from the 10th.
    expect(reminderDay("2026-11-12")).toBe("2026-11-10");
    expect(reminderDay("2027-01-01")).toBe("2026-12-30");
  });

  it("is due on the two days before the closing day, and not the day before them or on the closing day", () => {
    expect(reminderDue(ROW, "2026-10-17")).toBe(false);
    expect(reminderDue(ROW, "2026-10-18")).toBe(true);
    expect(reminderDue(ROW, "2026-10-19")).toBe(true);
    expect(reminderDue(ROW, "2026-10-20")).toBe(false);
  });

  it("is sent once per closing day: not again for the same day, again for a new one", () => {
    expect(reminderDue({ ...ROW, remindedFor: "2026-10-20" }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, remindedFor: "2026-10-15" }, "2026-10-18")).toBe(true);
  });

  it("is never due for a sample, a hidden request or a closed one", () => {
    expect(reminderDue({ ...ROW, askerId: null }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, hiddenAt: "2026-10-15T08:00:00.000Z" }, "2026-10-18")).toBe(false);
    expect(reminderDue({ ...ROW, status: "closed" }, "2026-10-18")).toBe(false);
  });
});
