import { afterEach, describe, expect, it, vi } from "vitest";
import { siteUrl } from "@/lib/site-url";
import robots from "./robots";

/** Does a robots.txt path pattern block `path`? Patterns match from the start; `*` is anything, a final `$` is the end. */
function blocks(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

describe("robots.txt (info and system spec 2.8)", () => {
  const { rules, sitemap } = robots();
  const rule = Array.isArray(rules) ? rules[0] : rules;
  const disallow = [rule.disallow ?? []].flat();
  const blocked = (path: string) => disallow.some((pattern) => blocks(pattern, path));

  it("lets every crawler in", () => {
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
  });

  it("keeps crawlers off Saved, sign-in, the account pages and the selling pages", () => {
    for (const path of [
      "/saved",
      "/login",
      "/login?next=%2Flistings%2Fl-001",
      "/account",
      "/account/privacy",
      "/sell",
      "/sell/onboarding",
    ]) {
      expect(blocked(path), path).toBe(true);
    }
  });

  it("doesn't catch pages that only start with the same letters (a bare /sell would hide every storefront)", () => {
    for (const path of ["/", "/browse", "/hub", "/looking-for", "/privacy", "/sellers/tech-corner", "/listings/l-001"]) {
      expect(blocked(path), path).toBe(false);
    }
  });

  it("doesn't advertise staff pages", () => {
    expect(disallow.join(" ")).not.toMatch(/admin|mentor|manage/);
  });

  it("points to the sitemap at the site's own address", () => {
    expect(sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});

describe("robots.txt with the whole site hidden (VOSSIE_NOINDEX=1, decision 68)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("disallows everything and leaves the sitemap out", () => {
    vi.stubEnv("VOSSIE_NOINDEX", "1");
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("is the usual file when VOSSIE_NOINDEX is anything but 1", () => {
    vi.stubEnv("VOSSIE_NOINDEX", "0");
    expect(robots().sitemap).toBe(`${siteUrl()}/sitemap.xml`);
  });
});
