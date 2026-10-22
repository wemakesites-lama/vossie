import { describe, expect, it } from "vitest";
import { sampleConsents } from "@/data/fixtures/accounts";
import {
  ATTEMPT_TTL_MS,
  CODE_TTL_MS,
  CODES_PER_HOUR,
  DEFAULT_EMAIL_DOMAINS,
  emailDomains,
  isDemoSignIn,
  isSampleMode,
  MAX_WRONG_TRIES,
  policyLabel,
  POLICY_VERSION,
  SESSION_TTL_MS,
  SIGN_IN_ERRORS_SHOW_MS,
  signInMode,
} from "./config";

describe("sign-in settings (accounts spec 2.1, 2.4 and 2.7)", () => {
  it("is in sample mode unless VOSSIE_SAMPLE_MODE is 0", () => {
    expect(isSampleMode({})).toBe(true);
    expect(isSampleMode({ VOSSIE_SAMPLE_MODE: "1" })).toBe(true);
    expect(isSampleMode({ VOSSIE_SAMPLE_MODE: "0" })).toBe(false);
  });

  it("lets eduvos.com and vossie.net sign in unless VOSSIE_EMAIL_DOMAINS lists others", () => {
    expect(DEFAULT_EMAIL_DOMAINS).toEqual(["eduvos.com", "vossie.net"]);
    expect(emailDomains({})).toEqual(["eduvos.com", "vossie.net"]);
    expect(emailDomains({ VOSSIE_EMAIL_DOMAINS: " Student.Eduvos.com, @eduvos.ac.za ,," })).toEqual([
      "student.eduvos.com",
      "eduvos.ac.za",
    ]);
    expect(emailDomains({ VOSSIE_EMAIL_DOMAINS: " , " })).toEqual(["eduvos.com", "vossie.net"]);
  });

  // Pinned, so a security limit can't change by accident. Changing one means changing this test on purpose.
  it("pins the sign-in limits (accounts spec 2.2, 2.5 and 5)", () => {
    expect(CODE_TTL_MS).toBe(10 * 60 * 1000);
    expect(MAX_WRONG_TRIES).toBe(5);
    expect(CODES_PER_HOUR).toBe(5);
    expect(ATTEMPT_TTL_MS).toBe(30 * 60 * 1000);
    expect(SESSION_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(SIGN_IN_ERRORS_SHOW_MS).toBe(60 * 1000);
  });

  it("names the policy version a student agrees to, which the sample accounts' consents use", () => {
    expect(POLICY_VERSION).toBe("2026-10-draft");
    expect(policyLabel(POLICY_VERSION)).toBe("draft of October 2026");
    expect(policyLabel("2027-01")).toBe("2027-01");
    for (const consent of sampleConsents) expect(consent.version).toBe(POLICY_VERSION);
  });
});

describe("the sign-in mode (Supabase phase B, decision 1)", () => {
  it("is sample by default, off with VOSSIE_SAMPLE_MODE=0, and supabase whenever VOSSIE_BACKEND says so", () => {
    expect(signInMode({})).toBe("sample");
    expect(signInMode({ VOSSIE_SAMPLE_MODE: "0" })).toBe("off");
    expect(signInMode({ VOSSIE_BACKEND: "supabase" })).toBe("supabase");
    expect(signInMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "1" })).toBe("supabase");
    expect(signInMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "0" })).toBe("supabase");
    expect(signInMode({ VOSSIE_BACKEND: "sample", VOSSIE_SAMPLE_MODE: "0" })).toBe("off");
  });

  it("offers the demo sign-in only on Supabase with VOSSIE_DEMO_SIGN_IN=1", () => {
    expect(isDemoSignIn({ VOSSIE_BACKEND: "supabase", VOSSIE_DEMO_SIGN_IN: "1" })).toBe(true);
    expect(isDemoSignIn({ VOSSIE_BACKEND: "supabase" })).toBe(false);
    expect(isDemoSignIn({ VOSSIE_BACKEND: "supabase", VOSSIE_DEMO_SIGN_IN: "true" })).toBe(false);
    expect(isDemoSignIn({ VOSSIE_DEMO_SIGN_IN: "1" })).toBe(false);
  });

  it("never counts as sample mode on Supabase, whatever VOSSIE_SAMPLE_MODE says", () => {
    expect(isSampleMode({ VOSSIE_BACKEND: "supabase" })).toBe(false);
    expect(isSampleMode({ VOSSIE_BACKEND: "supabase", VOSSIE_SAMPLE_MODE: "1" })).toBe(false);
    expect(isSampleMode({})).toBe(true);
  });
});
