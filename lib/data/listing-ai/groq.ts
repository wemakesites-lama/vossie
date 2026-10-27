import "server-only";
import Groq from "groq-sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Groq's qwen/qwen3.8-27b on the free tier (spec decision 9). A preview model Groq may withdraw: a 404 is "model-gone",
// and the model is changed here. The key is read on first use, never at module scope.

export const GROQ_MODEL = "qwen/qwen3.8-27b";

let client: Groq | null = null;
// Logging pinned off, so a GROQ_LOG=debug environment can never log a request, and with it a base64 photo.
const groq = () =>
  (client ??= new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0, logLevel: "off" }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Groq.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Groq.RateLimitError) return "rate-limited";
  if (error instanceof Groq.NotFoundError) return "model-gone";
  // Strict mode's own refusal of a reply that doesn't fit the schema: an answer, so no second provider (decision 11).
  if (error instanceof Groq.BadRequestError && JSON.stringify(error.error ?? "").includes("json_validate_failed")) {
    return "bad-output";
  }
  return "api-error";
}

export const read: ReadPhoto = async ({ image, instruction, schema }) => {
  // VOSSIE_GROQ_FORMAT=json_object if strict json_schema turns out to refuse an image (plan change 8).
  const strict = process.env.VOSSIE_GROQ_FORMAT !== "json_object";
  try {
    const completion = await groq().chat.completions.create({
      model: GROQ_MODEL,
      // A reply is about 150 to 300 tokens. Groq counts this reserve toward the free tier's 8,000 tokens a minute, so
      // 512 rather than 1,024 lets about twice as many fills through (spec section 13); a reply cut off is bad-output.
      max_completion_tokens: 512,
      // No reasoning ("none", which groq-sdk 1.6.0 documents for qwen3 models) and none returned: reasoning tokens
      // could use up the completion tokens or the 10 seconds before the JSON is written.
      reasoning_effort: "none",
      reasoning_format: "hidden",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: strict ? instruction : `${instruction}\nAnswer with JSON only.` },
            { type: "image_url", image_url: { url: `data:${image.type};base64,${image.base64}` } },
          ],
        },
      ],
      response_format: strict
        ? { type: "json_schema", json_schema: { name: "listing_suggestion", schema: { ...schema }, strict: true } }
        : { type: "json_object" },
    });
    const choice = completion.choices[0];
    // Cut off at the token limit: the JSON is unfinished, so it's an answer that fails the check, not a busy service.
    if (choice?.finish_reason === "length") return { ok: false, failure: "bad-output" };
    const text = choice?.message?.content;
    return text ? { ok: true, text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
