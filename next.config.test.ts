import { afterEach, describe, expect, it, vi } from "vitest";
import nextConfig from "./next.config";

afterEach(() => vi.unstubAllEnvs());

/** The headers sent on every path, by name. */
async function sitewideHeaders(): Promise<Record<string, string>> {
  const rules = await nextConfig.headers!();
  const rule = rules.find((item) => item.source === "/:path*");
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
}

describe("security headers (info and system spec 2.9)", () => {
  it("sends the four headers on every path", async () => {
    expect(await sitewideHeaders()).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });

  it("adds Strict-Transport-Security in production only", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await sitewideHeaders()).not.toHaveProperty("Strict-Transport-Security");
    vi.stubEnv("NODE_ENV", "production");
    expect(await sitewideHeaders()).toHaveProperty("Strict-Transport-Security", "max-age=31536000");
  });

  it("sets no Content-Security-Policy yet (it needs a nonce per request; see the go-live checklist)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await sitewideHeaders()).not.toHaveProperty("Content-Security-Policy");
  });

  it("keeps the redirects it already had", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.map((redirect) => redirect.source)).toEqual(
      expect.arrayContaining(["/categories/:slug", "/c/:campus"]),
    );
  });
});
