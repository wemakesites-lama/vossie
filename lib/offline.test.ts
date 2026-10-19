import { describe, expect, it } from "vitest";
import { STATIC_PATHS } from "./sitemap";
import { OFFLINE_PAGE, OFFLINE_PATH } from "./offline";

const page = () => new DOMParser().parseFromString(OFFLINE_PAGE, "text/html");

describe("the offline page (community actions spec 2.20)", () => {
  it("is a whole document in South African English, kept out of search", () => {
    expect(OFFLINE_PAGE.startsWith("<!doctype html>")).toBe(true);
    expect(OFFLINE_PAGE).toContain('<html lang="en-ZA">');
    expect(OFFLINE_PAGE).toContain('<meta name="robots" content="noindex">');
    expect(OFFLINE_PATH).toBe("/offline");
    expect(STATIC_PATHS).not.toContain("/offline");
  });

  it("says you're offline, what to check, and Try again, a link to the same address", () => {
    const doc = page();
    expect([...doc.querySelectorAll("h1")].map((heading) => heading.textContent)).toEqual(["You're offline"]);
    expect(doc.body.textContent).toContain("Vossie needs a connection to show listings and messages. Check your data or Wi-Fi.");
    expect(doc.querySelector(".brand")?.textContent).toBe("Vossie");
    const tryAgain = doc.querySelector("a");
    expect(tryAgain?.textContent).toBe("Try again");
    expect(tryAgain?.getAttribute("href")).toBe("");
  });

  it("needs nothing else: no script, no image, no outside file, under 4 KB", () => {
    expect(OFFLINE_PAGE).not.toMatch(/<script|<img|<link|<svg|src=|url\(|@import/i);
    expect(new TextEncoder().encode(OFFLINE_PAGE).length).toBeLessThan(4096);
  });

  it("sets the brand faces' fallbacks once, as --vos-font-*, and uses navy on white", () => {
    expect(OFFLINE_PAGE).toContain('--vos-font-display:"Arial Narrow",sans-serif');
    expect(OFFLINE_PAGE).toContain("--vos-font-text:ui-sans-serif,system-ui,sans-serif");
    expect(OFFLINE_PAGE).toContain("#15305d");
    expect(OFFLINE_PAGE).toContain("background:#fff");
    expect(OFFLINE_PAGE).toContain("min-height:44px");
  });
});
