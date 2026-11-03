import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());

// The SDK's real error classes, with only the request faked: the provider tells failures apart by class.
vi.mock("groq-sdk", async (original) => {
  const real = (await original<typeof import("groq-sdk")>()).default;
  class FakeGroq {
    chat = { completions: { create } };
    static APIConnectionTimeoutError = real.APIConnectionTimeoutError;
    static RateLimitError = real.RateLimitError;
    static NotFoundError = real.NotFoundError;
    static BadRequestError = real.BadRequestError;
  }
  return { default: FakeGroq };
});

import Groq from "groq-sdk";
import { read } from "./groq";

const REQUEST = {
  system: "Describe it.",
  images: [
    { type: "image/jpeg" as const, base64: "AQID" },
    { type: "image/jpeg" as const, base64: "BAUG" },
  ],
  text: "The photos show one item or service, the cover first.",
  schema: {},
};
const refused = () =>
  new Groq.BadRequestError(400, { error: { code: "json_validate_failed" } }, "Failed to validate JSON", new Headers());
const answer = (content: string) => ({ choices: [{ finish_reason: "stop", message: { content } }] });

beforeEach(() => create.mockReset());

describe("the Groq provider's one retry (spec section 13)", () => {
  it("asks once more when Groq refuses the format, and returns the second reply", async () => {
    create.mockRejectedValueOnce(refused()).mockResolvedValueOnce(answer('{"title":"Dust"}'));
    expect(await read(REQUEST)).toEqual({ ok: true, text: '{"title":"Dust"}' });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("stops after the second refusal, as bad output", async () => {
    create.mockRejectedValueOnce(refused()).mockRejectedValueOnce(refused());
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "bad-output" });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("never retries any other failure", async () => {
    create.mockRejectedValueOnce(new Groq.RateLimitError(429, {}, "Too many requests", new Headers()));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "rate-limited" });
    create.mockRejectedValueOnce(new Groq.BadRequestError(400, { error: { code: "invalid_request" } }, "Bad", new Headers()));
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "api-error" });
    create.mockResolvedValueOnce({ choices: [{ finish_reason: "length", message: { content: '{"title":' } }] });
    expect(await read(REQUEST)).toEqual({ ok: false, failure: "bad-output" });
    expect(create).toHaveBeenCalledTimes(3);
  });

  it("sends the system prompt as a system message and the cover photo only (AI features spec 2.2)", async () => {
    create.mockResolvedValueOnce(answer("{}"));
    await read(REQUEST);
    const { messages } = create.mock.calls[0][0];
    expect(messages[0]).toEqual({ role: "system", content: "Describe it." });
    const images = messages[1].content.filter((part: { type: string }) => part.type === "image_url");
    expect(images).toEqual([{ type: "image_url", image_url: { url: "data:image/jpeg;base64,AQID" } }]);
  });
});
