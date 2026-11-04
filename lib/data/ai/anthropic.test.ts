import { afterEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());

// The SDK's real error classes, with only the request faked: the provider tells failures apart by class.
vi.mock("@anthropic-ai/sdk", async (original) => {
  const real = (await original<typeof import("@anthropic-ai/sdk")>()).default;
  class FakeAnthropic {
    messages = { create };
    static APIConnectionTimeoutError = real.APIConnectionTimeoutError;
    static RateLimitError = real.RateLimitError;
    static NotFoundError = real.NotFoundError;
  }
  return { default: FakeAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { read } from "./anthropic";

const REQUEST = {
  task: "photo-to-listing" as const,
  system: "Describe it.",
  images: [
    { type: "image/jpeg" as const, base64: "AQ==" },
    { type: "image/png" as const, base64: "Ag==" },
  ],
  text: "The photos show one item or service, the cover first.",
  schema: { type: "object" },
};
const answer = (text: string, stop_reason = "end_turn") => ({ stop_reason, content: [{ type: "text", text }] });

afterEach(() => {
  create.mockReset();
  vi.unstubAllEnvs();
});

describe("the Haiku provider (AI features spec 2.2 to 2.5)", () => {
  it("sends the system prompt, every photo in order, then the text, at low effort in 10 seconds", async () => {
    create.mockResolvedValueOnce(answer('{"title":"Dust"}'));
    expect(await read(REQUEST)).toEqual({ ok: true, text: '{"title":"Dust"}' });
    const [body, options] = create.mock.calls[0];
    expect(body).toMatchObject({
      model: "claude-haiku-5-5",
      system: "Describe it.",
      output_config: { effort: "low", format: { type: "json_schema", schema: { type: "object" } } },
    });
    // Each photo follows its label, so a photo tip's number names the right photo (AI stage F).
    expect(body.messages[0].content.map((block: { type: string; text?: string }) => block.text ?? block.type)).toEqual([
      "Photo 1",
      "image",
      "Photo 2",
      "image",
      REQUEST.text,
    ]);
    expect(body.messages[0].content[3].source).toEqual({ type: "base64", media_type: "image/png", data: "Ag==" });
    expect(options).toEqual({ timeout: 10_000 });
  });

  it("thinks at medium effort with 15 seconds when VOSSIE_HAIKU_EFFORT says so", async () => {
    vi.stubEnv("VOSSIE_HAIKU_EFFORT", "medium");
    create.mockResolvedValueOnce(answer("{}"));
    await read(REQUEST);
    const [body, options] = create.mock.calls[0];
    expect(body.output_config.effort).toBe("medium");
    expect(options).toEqual({ timeout: 15_000 });
  });

  it("keeps a quick request (the words search) at low effort with its own wait, whatever the setting", async () => {
    vi.stubEnv("VOSSIE_HAIKU_EFFORT", "medium");
    create.mockResolvedValueOnce(answer("{}"));
    await read({ ...REQUEST, quick: { timeoutMs: 3_000 } });
    const [body, options] = create.mock.calls[0];
    expect(body.output_config.effort).toBe("low");
    expect(options).toEqual({ timeout: 3_000 });
  });

  it("answers a refusal and a cut-off reply as answers, and a busy service as a reason to move on", async () => {
    create.mockResolvedValueOnce(answer("", "refusal"));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "refusal" });
    create.mockResolvedValueOnce(answer('{"title":', "max_tokens"));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "bad-output" });
    create.mockRejectedValueOnce(new Anthropic.RateLimitError(429, {}, "Too many requests", new Headers()));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "rate-limited" });
    create.mockRejectedValueOnce(new Anthropic.APIConnectionTimeoutError());
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "timeout" });
  });
});
