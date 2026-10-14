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

  it("accepts an address at a listed domain or a subdomain of one", () => {
    expect(checkEmail("thandi@eduvos.com", ["eduvos.com"])).toBe("ok");
    expect(checkEmail("thandi@student.eduvos.com", ["eduvos.com"])).toBe("ok");
    expect(checkEmail("thandi@eduvos.ac.za", ["eduvos.com", "eduvos.ac.za"])).toBe("ok");
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

  it("reads VOSSIE_EMAIL_DOMAINS when no list is given", () => {
    vi.stubEnv("VOSSIE_EMAIL_DOMAINS", "eduvos.ac.za");
    expect(checkEmail("thandi@eduvos.ac.za")).toBe("ok");
    expect(checkEmail("thandi@eduvos.com")).toBe("domain");
  });

  it("masks an email for \"We sent a code to …\" (spec 3.1)", () => {
    expect(maskEmail("thandi@eduvos.com")).toBe("t•••@eduvos.com");
    expect(maskEmail("t@student.eduvos.com")).toBe("t•••@student.eduvos.com");
  });
});
