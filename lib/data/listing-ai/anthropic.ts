import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Claude Haiku 5.5, the fallback (spec decision 9; listed only once Lama adds it, Q6). Structured outputs, effort low.

export const HAIKU_MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;
const anthropic = () =>
  (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: PROVIDER_TIMEOUT_MS, maxRetries: 0 }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.RateLimitError) return "rate-limited";
  if (error instanceof Anthropic.NotFoundError) return "model-gone";
  return "api-error";
}

export const read: ReadPhoto = async ({ image, instruction, schema }) => {
  try {
    const message = await anthropic().messages.create({
      model: HAIKU_MODEL,
      max_tokens: 2048,
      output_config: { effort: "low", format: { type: "json_schema", schema: { ...schema } } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.type, data: image.base64 } },
            { type: "text", text: instruction },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") return { ok: false, failure: "refusal" };
    const text = message.content.find((block) => block.type === "text");
    return text && text.type === "text" ? { ok: true, text: text.text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
