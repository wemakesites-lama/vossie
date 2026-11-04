import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { PROVIDER_TIMEOUT_MS, type ProviderFailure, type ReadPhoto } from "./types";

// Claude Haiku 5.5, the first choice (AI features spec decision 1, Lama's Q1), with structured outputs. It reads every
// photo it's sent. Its effort is VOSSIE_HAIKU_EFFORT, low (the default) or medium, chosen by the photo test (spec
// section 8); medium thinks for longer, so it gets 15 seconds. The key is read on first use, never at module scope.

export const HAIKU_MODEL = "claude-haiku-5-5";

type Effort = "low" | "medium";
const effort = (): Effort => (process.env.VOSSIE_HAIKU_EFFORT === "medium" ? "medium" : "low");
const TIMEOUT_MS: Readonly<Record<Effort, number>> = { low: PROVIDER_TIMEOUT_MS, medium: 15_000 };

let client: Anthropic | null = null;
// Logging pinned off, so an ANTHROPIC_LOG=debug environment can never log a request, and with it a base64 photo.
const anthropic = () =>
  (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, logLevel: "off" }));

function failureOf(error: unknown): ProviderFailure {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (error instanceof Anthropic.RateLimitError) return "rate-limited";
  if (error instanceof Anthropic.NotFoundError) return "model-gone";
  return "api-error";
}

export const read: ReadPhoto = async ({ system, images, text, schema, quick }) => {
  // A quick request (the words search) is always low effort with its own short wait, whatever VOSSIE_HAIKU_EFFORT says.
  const level: Effort = quick ? "low" : effort();
  try {
    const message = await anthropic().messages.create(
      {
        model: HAIKU_MODEL,
        // A reply is about 150 to 300 tokens; the rest leaves room for medium effort's thinking.
        max_tokens: 4096,
        system,
        output_config: { effort: level, format: { type: "json_schema", schema: { ...schema } } },
        messages: [
          {
            role: "user",
            content: [
              // Each photo follows its label ("Photo 1" is the cover), so a photo tip's number names the right one
              // (AI stage F).
              ...images.flatMap((image, at) => [
                { type: "text" as const, text: `Photo ${at + 1}` },
                {
                  type: "image" as const,
                  source: { type: "base64" as const, media_type: image.type, data: image.base64 },
                },
              ]),
              { type: "text" as const, text },
            ],
          },
        ],
      },
      { timeout: quick?.timeoutMs ?? TIMEOUT_MS[level] },
    );
    if (message.stop_reason === "refusal") return { ok: false, failure: "refusal" };
    // Cut off: the JSON is unfinished, so it's an answer that fails the check, not a busy service.
    if (message.stop_reason === "max_tokens") return { ok: false, failure: "bad-output" };
    const reply = message.content.find((block) => block.type === "text");
    return reply && reply.type === "text" ? { ok: true, text: reply.text } : { ok: false, failure: "api-error" };
  } catch (error) {
    return { ok: false, failure: failureOf(error) };
  }
};
