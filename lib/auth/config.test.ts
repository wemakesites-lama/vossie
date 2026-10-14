import { describe, expect, it } from "vitest";
import { sampleConsents } from "@/data/fixtures/accounts";
import {
  ATTEMPT_TTL_MS,
  CODE_TTL_MS,
  CODES_PER_HOUR,
  emailDomains,
  isSampleMode,
  MAX_WRONG_TRIES,
  policyLabel,
  POLICY_VERSION,
  SESSION_TTL_MS,
} from "./config";

describe("sign-in settings (accounts spec 2.1, 2.4 and 2.7)", () => {
  it("is in sample mode unless VOSSIE_SAMPLE_MODE is 0", () => {
    expect(isSampleMode({})).toBe(true);
    expect(isSampleMode({ VOSSIE_SAMPLE_MODE: "1" })).toBe(true);
    expect(isSampleMode({ VOSSIE_SAMPLE_MODE: "0" })).toBe(false);
  });

  it("lets eduvos.com sign in unless VOSSIE_EMAIL_DOMAINS lists others", () => {
    expect(emailDomains({})).toEqual(["eduvos.com"]);
    expect(emailDomains({ VOSSIE_EMAIL_DOMAINS: " Student.Eduvos.com, @eduvos.ac.za ,," })).toEqual([
      "student.eduvos.com",
      "eduvos.ac.za",
    ]);
    expect(emailDomains({ VOSSIE_EMAIL_DOMAINS: " , " })).toEqual(["eduvos.com"]);
  });

  // Pinned, so a security limit can't change by accident. Changing one means changing this test on purpose.
  it("pins the sign-in limits (accounts spec 2.2, 2.5 and 5)", () => {
    expect(CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(MAX_WRONG_TRIES).toBe(5);
    expect(CODES_PER_HOUR).toBe(5);
    expect(ATTEMPT_TTL_MS).toBe(30 * 60 * 1000);
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it("names the policy version a student agrees to, which the sample accounts' consents use", () => {
    expect(POLICY_VERSION).toBe("2026-10-draft");
    expect(policyLabel(POLICY_VERSION)).toBe("draft of October 2026");
    expect(policyLabel("2027-01")).toBe("2027-01");
    for (const consent of sampleConsents) expect(consent.version).toBe(POLICY_VERSION);
  });
});
