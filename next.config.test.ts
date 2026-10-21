import { afterEach, describe, expect, it, vi } from "vitest";
import { PHOTO_MAX_BYTES, POST_PHOTOS_MAX_BYTES } from "@/lib/photos/rules";
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

  it("hides every page from search engines when VOSSIE_NOINDEX is 1 (decision 68)", async () => {
    vi.stubEnv("VOSSIE_NOINDEX", "1");
    expect(await sitewideHeaders()).toHaveProperty("X-Robots-Tag", "noindex, nofollow");
  });

  it("sends no X-Robots-Tag when VOSSIE_NOINDEX is unset or anything but 1", async () => {
    for (const value of ["", "0", "true"]) {
      vi.stubEnv("VOSSIE_NOINDEX", value);
      expect(await sitewideHeaders(), value).not.toHaveProperty("X-Robots-Tag");
    }
  });

  it("keeps the redirects it already had", async () => {
    const redirects = await nextConfig.redirects!();
    expect(redirects.map((redirect) => redirect.source)).toEqual(
      expect.arrayContaining(["/categories/:slug", "/c/:campus"]),
    );
  });
});

/** A size as Next reads bodySizeLimit (the bytes package: "5mb" is 5 MiB). */
const mebibytes = (limit: string) => Number(/^(\d+)mb$/.exec(limit)?.[1]) * 1024 * 1024;

describe("uploads (selling spec 2.3, plan decision 12)", () => {
  it("lets a Server Action take 5 MB: a post's 4 MiB of photos, or one 4 MB photo, with the form (C2/C3 review fix 3)", () => {
    const limit = nextConfig.experimental?.serverActions?.bodySizeLimit;
    expect(limit).toBe("5mb");
    // About 300 KB of typed text at the very worst (C2/C3 plan decision 16), and the multipart overhead (serverActions.md).
    const text = 300_000 + 20_000;
    expect(mebibytes(String(limit))).toBeGreaterThanOrEqual(POST_PHOTOS_MAX_BYTES + text);
    expect(mebibytes(String(limit))).toBeGreaterThanOrEqual(PHOTO_MAX_BYTES + text);
  });

  it("keeps no resized photos on the server's disk, so a deleted photo can't be served again", () => {
    expect(nextConfig.images?.maximumDiskCacheSize).toBe(0);
  });

  it("keeps a resized photo for an hour at most, so a hidden or deleted listing's photo stops being served (fix 2)", () => {
    // The optimizer keeps a resized copy for the larger of this and the photo's own max-age (image.md,
    // minimumCacheTTL), and /photos/[id] says an hour for a photo that's everyone's.
    expect(nextConfig.images?.minimumCacheTTL).toBe(3600);
  });
});
