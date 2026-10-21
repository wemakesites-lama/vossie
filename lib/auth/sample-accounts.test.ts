import { afterEach, describe, expect, it, vi } from "vitest";
import { isSampleAccount } from "./sample-accounts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the sample accounts (stage K spec decision 10)", () => {
  const SAMPLES = ["student@eduvos.com", "seller@eduvos.com", "pending@eduvos.com", "mentor@eduvos.com", "admin@eduvos.com"];

  it("knows the five, in sample mode", () => {
    for (const email of SAMPLES) expect(isSampleAccount({ email }), email).toBe(true);
    expect(isSampleAccount({ email: "ayanda@eduvos.com" })).toBe(false);
  });

  it("knows none of them with sample mode off", () => {
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "0");
    for (const email of SAMPLES) expect(isSampleAccount({ email }), email).toBe(false);
  });

  it("knows none of them on Supabase, the test address included, whatever VOSSIE_SAMPLE_MODE says (stage K amendment 7)", () => {
    vi.stubEnv("VOSSIE_BACKEND", "supabase");
    vi.stubEnv("VOSSIE_SAMPLE_MODE", "1");
    for (const email of [...SAMPLES, "student@vossie.test"]) expect(isSampleAccount({ email }), email).toBe(false);
  });
});
