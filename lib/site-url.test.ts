import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SITE_URL, siteUrl } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl (info and system spec 2.7)", () => {
  it("falls back to the local server when nothing is set", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    expect(siteUrl()).toBe("http://localhost:3000");
    expect(DEFAULT_SITE_URL).toBe("http://localhost:3000");
  });

  it("treats a blank value as unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "   ");
    expect(siteUrl()).toBe(DEFAULT_SITE_URL);
  });

  it("returns the site's origin, without a trailing slash, a path or a query", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://vossie.example/");
    expect(siteUrl()).toBe("https://vossie.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://www.vossie.example/some/page?x=1");
    expect(siteUrl()).toBe("https://www.vossie.example");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", " http://localhost:3200 ");
    expect(siteUrl()).toBe("http://localhost:3200");
  });

  it("refuses a value that isn't a web address, so a typo can't ship wrong share cards", () => {
    for (const bad of ["vossie.example", "localhost:3000", "ftp://vossie.example", "javascript:alert(1)", "https://"]) {
      vi.stubEnv("NEXT_PUBLIC_SITE_URL", bad);
      expect(() => siteUrl(), bad).toThrow(/NEXT_PUBLIC_SITE_URL must be a web address/);
    }
  });

  it("warns once when a production build has no address, and never in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const dev = await import("./site-url");
    dev.siteUrl();
    expect(warn).not.toHaveBeenCalled();

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const prod = await import("./site-url");
    prod.siteUrl();
    prod.siteUrl();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/NEXT_PUBLIC_SITE_URL isn't set/);
  });
});
