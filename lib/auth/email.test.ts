import { afterEach, describe, expect, it, vi } from "vitest";
import { checkEmail, maskEmail, normaliseEmail } from "./email";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Eduvos emails (accounts spec 2.4)", () => {
  it("tidies an email the way the store keeps it", () => {
    expect(normaliseEmail("  Thandi.M@EDUVOS.com ")).toBe("thandi.m@eduvos.com");
  });

  it("says when there's no email", () => {
    expect(checkEmail("", ["eduvos.com"])).toBe("missing");
  });

  it("accepts only an address at a listed domain", () => {
    expect(checkEmail("thandi@eduvos.com", ["eduvos.com"])).toBe("ok");
    expect(checkEmail("eduv1234567@vossie.net", ["eduvos.com", "vossie.net"])).toBe("ok");
    expect(checkEmail("thandi@eduvos.ac.za", ["eduvos.com", "eduvos.ac.za"])).toBe("ok");
    // Exact domains only (Lama, 2026-10-21): a subdomain of a listed domain is refused, as private.email_allowed does.
    expect(checkEmail("thandi@student.eduvos.com", ["eduvos.com"])).toBe("domain");
    expect(checkEmail("a@mail.vossie.net", ["eduvos.com", "vossie.net"])).toBe("domain");
  });

  it("refuses other domains, look-alikes and things that aren't addresses", () => {
    for (const email of [
      "thandi@gmail.com",
      "thandi@noteduvos.com",
      "thandi@eduvos.com.evil.example",
      "thandi@eduvos",
      "thandi",
      "@eduvos.com",
      "thandi@@eduvos.com",
      "th andi@eduvos.com",
      `${"a".repeat(250)}@eduvos.com`,
    ]) {
      expect(checkEmail(email, ["eduvos.com"]), email).toBe("domain");
    }
  });

  it("refuses a domain that isn't shaped like one, even when it ends with a listed domain", () => {
    for (const email of [
      "student@.eduvos.com",
      "student@eduvos.com.",
      "student@student.eduvos.com.",
      "student@a..eduvos.com",
      "student@-.eduvos.com",
      "student@evil-eduvos.com",
      "student@eduvos.com.evil.example",
    ]) {
      expect(checkEmail(email, ["eduvos.com"]), email).toBe("domain");
    }
  });

  it("refuses anything that isn't ASCII, so a look-alike letter can't pass as a listed domain", () => {
    const kelvin = "a@u\u212Azn.ac.za"; // the Kelvin sign, which looks like the K in "ukzn"
    expect(checkEmail(kelvin, ["ukzn.ac.za"])).toBe("domain");
    expect(checkEmail("a@ukzn.ac.za", ["ukzn.ac.za"])).toBe("ok");
    // A Cyrillic "е" in "eduvos", a full-width "@", and invisible or accented letters in the part before the @.
    expect(checkEmail("student@\u0435duvos.com", ["eduvos.com"])).toBe("domain");
    expect(checkEmail("student\uFF20eduvos.com", ["eduvos.com"])).toBe("domain");
    expect(checkEmail("stu\u200Bdent@eduvos.com", ["eduvos.com"])).toBe("domain");
    expect(checkEmail("stüdent@eduvos.com", ["eduvos.com"])).toBe("domain");
    expect(checkEmail("stu\u0000dent@eduvos.com", ["eduvos.com"])).toBe("domain");
  });

  it("sees what lower-casing does to a look-alike: the Kelvin sign becomes a plain k, a dotted capital I doesn't", () => {
    // normaliseEmail turns the Kelvin sign into the real "k", so the address (and the mailbox the code goes to) is the
    // genuine one. A dotted capital I lower-cases to "i" plus a combining dot, which is not ASCII and so is refused.
    expect(normaliseEmail("a@uKzn.ac.za")).toBe("a@ukzn.ac.za");
    expect(checkEmail(normaliseEmail("a@uKzn.ac.za"), ["ukzn.ac.za"])).toBe("ok");
    expect(checkEmail(normaliseEmail("Thandİ@eduvos.com"), ["eduvos.com"])).toBe("domain");
  });

  it("still takes the usual marks in the part before the @", () => {
    expect(checkEmail("thandi.m+vossie_1@eduvos.com", ["eduvos.com"])).toBe("ok");
  });

  it("passes an address as the form gives it, once it's normalised", () => {
    expect(checkEmail(normaliseEmail("Student@EDUVOS.COM "), ["eduvos.com"])).toBe("ok");
    expect(checkEmail(normaliseEmail("  Thandi.M@Eduvos.com"), ["eduvos.com"])).toBe("ok");
  });

  it("reads VOSSIE_EMAIL_DOMAINS when no list is given", () => {
    vi.stubEnv("VOSSIE_EMAIL_DOMAINS", "eduvos.ac.za");
    expect(checkEmail("thandi@eduvos.ac.za")).toBe("ok");
    expect(checkEmail("thandi@eduvos.com")).toBe("domain");
  });

  it("masks an email for \"We sent a code to …\" (spec 3.1)", () => {
    expect(maskEmail("thandi@eduvos.com")).toBe("t•••@eduvos.com");
    expect(maskEmail("t@student.eduvos.com")).toBe("t•••@student.eduvos.com");
  });

  it("keeps a whole first character, so an emoji or other pair of code units isn't split", () => {
    expect(maskEmail("\u{1F600}smile@eduvos.com")).toBe("\u{1F600}•••@eduvos.com");
    expect(maskEmail("\u{20BB7}a@eduvos.com")).toBe("\u{20BB7}•••@eduvos.com");
  });
});
