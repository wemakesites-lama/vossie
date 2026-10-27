// lib/data/listing-ai.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderReply } from "./listing-ai/types";

const groq = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
const anthropic = vi.hoisted(() => vi.fn<() => Promise<ProviderReply>>());
vi.mock("./listing-ai/groq", () => ({ read: groq }));
vi.mock("./listing-ai/anthropic", () => ({ read: anthropic }));

import { FAKE_REPLY } from "./listing-ai/fake";
import { readCoverPhoto } from "./listing-ai";

const PHOTO = { type: "image/jpeg" as const, bytes: new Uint8Array([1, 2, 3]) };
const SLUGS = ["textbooks-notes", "tech"];
const good: ProviderReply = { ok: true, text: JSON.stringify(FAKE_REPLY) };

beforeEach(() => {
  vi.stubEnv("VOSSIE_LISTING_AI_PROVIDERS", "groq,anthropic");
  vi.stubEnv("GROQ_API_KEY", "g");
  vi.stubEnv("ANTHROPIC_API_KEY", "a");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  groq.mockReset();
  anthropic.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("readCoverPhoto (spec decisions 9 to 11)", () => {
  it("returns the first provider's checked suggestion, sending the photo as base64 with the form's categories", async () => {
    groq.mockResolvedValue(good);
    expect(await readCoverPhoto(PHOTO, SLUGS)).toMatchObject({ ok: true, suggestion: { moduleCode: "FAC1501" } });
    expect(groq).toHaveBeenCalledWith(
      expect.objectContaining({ image: { type: "image/jpeg", base64: "AQID" } }),
    );
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("moves on only when the first couldn't answer", async () => {
    for (const failure of ["timeout", "rate-limited", "model-gone", "api-error"] as const) {
      groq.mockResolvedValueOnce({ ok: false, failure });
      anthropic.mockResolvedValueOnce(good);
      expect(await readCoverPhoto(PHOTO, SLUGS)).toMatchObject({ ok: true });
    }
    expect(anthropic).toHaveBeenCalledTimes(4);
  });

  it("never sends a refusal, a bad reply or a person to a second provider", async () => {
    groq.mockResolvedValueOnce({ ok: false, failure: "refusal" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "refusal" });
    groq.mockResolvedValueOnce({ ok: true, text: "{}" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "bad-output" });
    groq.mockResolvedValueOnce({ ok: true, text: JSON.stringify({ ...FAKE_REPLY, personIsSubject: true }) });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "person" });
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("skips a provider without its key, and reports the last failure when none can answer", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    anthropic.mockResolvedValueOnce({ ok: false, failure: "rate-limited" });
    expect(await readCoverPhoto(PHOTO, SLUGS)).toEqual({ ok: false, failure: "rate-limited" });
    expect(groq).not.toHaveBeenCalled();
  });

  it("logs a failure by provider and kind only, never the photo or the text", async () => {
    groq.mockResolvedValueOnce({ ok: true, text: "Financial Accounting" });
    await readCoverPhoto(PHOTO, SLUGS);
    expect(console.warn).toHaveBeenCalledWith("[vossie] photo-to-listing: groq bad-output");
  });
});
