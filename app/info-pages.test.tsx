import { render } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeAll, describe, expect, it } from "vitest";
import HowItWorksPage from "./how-it-works/page";
import PrivacyPage from "./privacy/page";
import SafetyPage from "./safety/page";
import SellerGuidelinesPage from "./seller-guidelines/page";
import TermsPage from "./terms/page";
import TrustPage from "./trust/page";

const PAGES: ReadonlyArray<[path: string, Page: ComponentType]> = [
  ["/how-it-works", HowItWorksPage],
  ["/safety", SafetyPage],
  ["/trust", TrustPage],
  ["/privacy", PrivacyPage],
  ["/terms", TermsPage],
  ["/seller-guidelines", SellerGuidelinesPage],
];

/** Every route a link on these pages may point at: the six pages, and the rest of the site. */
const ROUTES = new Set([...PAGES.map(([path]) => path), "/", "/browse", "/hub", "/looking-for", "/sell", "/login", "/account", "/account/privacy"]);

type Inspected = { path: string; h1s: number; sectionIds: string[]; contents: string[]; links: string[] };

function inspect(path: string, Page: ComponentType): Inspected {
  const { container, unmount } = render(<Page />);
  const inspected = {
    path,
    h1s: container.querySelectorAll("h1").length,
    sectionIds: [...container.querySelectorAll(".info-body > section")].map((section) => section.id),
    contents: [...container.querySelectorAll(".info-toc a")].map((link) => link.getAttribute("href") ?? ""),
    links: [...container.querySelectorAll(".info-body a")].map((link) => link.getAttribute("href") ?? ""),
  };
  unmount();
  return inspected;
}

describe("the six info pages together (info and system spec 3 and 6)", () => {
  let pages: Inspected[] = [];

  beforeAll(() => {
    pages = PAGES.map(([path, Page]) => inspect(path, Page));
  });

  it("each has one h1 and a contents list that matches its sections, in order", () => {
    for (const page of pages) {
      expect(page.h1s, page.path).toBe(1);
      expect(page.sectionIds.length, page.path).toBeGreaterThan(0);
      expect(page.contents, page.path).toEqual(page.sectionIds.map((id) => `#${id}`));
    }
  });

  it("never repeats a section id across pages (Next keeps the last pages hidden in the DOM)", () => {
    const all = pages.flatMap((page) => page.sectionIds);
    expect(new Set(all).size).toBe(all.length);
    for (const page of pages) {
      const prefix = page.path === "/how-it-works" ? "how-" : `${page.path.slice(1).replace("seller-", "")}-`;
      for (const id of page.sectionIds) expect(id.startsWith(prefix), `${page.path}: ${id}`).toBe(true);
    }
  });

  it("links only to pages that exist, and to sections that exist", () => {
    for (const page of pages) {
      for (const href of page.links) {
        if (href.startsWith("https://")) continue;
        const [route, hash] = href.split("#");
        const target = route === "" ? page : pages.find((other) => other.path === route);
        expect(route === "" || ROUTES.has(route), `${page.path} links to ${href}`).toBe(true);
        if (hash) expect(target?.sectionIds, `${page.path} links to ${href}`).toContain(hash);
      }
    }
  });

  it("sends people to other websites over https only", () => {
    for (const page of pages) {
      for (const href of page.links.filter((link) => /^[a-z]+:/.test(link))) {
        expect(href, page.path).toMatch(/^https:\/\//);
      }
    }
  });
});
