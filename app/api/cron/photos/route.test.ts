import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";
import { sweepPhotos } from "@/lib/data/photos";
import { GET } from "./route";

// The photo sweep's Route Handler in sample mode (C2/C3 plan Task 7): a 404 that nothing keeps, and nothing swept. A
// Vercel Cron call never reaches proxy.ts either: it carries no session cookie (phase B's matcher).
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/data/photos", async (original) => {
  const photos = await original<typeof import("@/lib/data/photos")>();
  return { ...photos, sweepPhotos: vi.fn(photos.sweepPhotos) };
});

const SECRET = "c".repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/api/cron/photos in sample mode (C2/C3 plan Task 7)", () => {
  it("is a 404 with no-store, even with the right secret, and sweeps nothing", async () => {
    vi.stubEnv("CRON_SECRET", SECRET);
    const response = await GET(new Request("http://localhost/api/cron/photos", { headers: { Authorization: `Bearer ${SECRET}` } }));
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(sweepPhotos).not.toHaveBeenCalled();
  });

  it("is never reached by proxy.ts without a session cookie, as a Vercel Cron call has none", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/photos", cookies: {} })).toBe(false);
    expect(unstable_doesMiddlewareMatch({ config, url: "/api/cron/photos", headers: { authorization: `Bearer ${SECRET}` } })).toBe(
      false,
    );
  });
});
