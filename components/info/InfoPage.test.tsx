import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { InfoPage, type InfoSection } from "./InfoPage";

const sections: InfoSection[] = [
  { id: "demo-first", title: "First part", children: <p>First body.</p> },
  { id: "demo-second", title: "Second part", children: <p>Second body.</p> },
];

function renderPage(props: Partial<ComponentProps<typeof InfoPage>> = {}) {
  return render(
    <InfoPage
      route="/safety"
      title="Demo page"
      lede="One line about it."
      updated="2026-10-14"
      sections={sections}
      {...props}
    />,
  );
}

describe("InfoPage (info and system spec 2.5)", () => {
  it("leads with the trail back to Home, the page named by its title (wayfinding spec 3.1)", () => {
    renderPage();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/");
    expect(screen.getByText("Demo page", { selector: "[aria-current]" })).toBeInTheDocument();
  });

  it("has one h1, the lede and the date the page last changed", () => {
    const { container } = renderPage();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Demo page" })).toBeInTheDocument();
    expect(screen.getByText("One line about it.")).toBeInTheDocument();
    expect(container.querySelector(".info-updated")).toHaveTextContent("Last updated 14 October 2026");
    expect(container.querySelector("time")).toHaveAttribute("datetime", "2026-10-14");
  });

  it("lists every section under 'On this page', each link pointing at its section", () => {
    const { container } = renderPage();
    const nav = screen.getByRole("navigation", { name: "On this page" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["First part", "Second part"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["#demo-first", "#demo-second"]);
    expect(container.querySelector("section#demo-first")).not.toBeNull();
    expect(container.querySelector("section#demo-second")).not.toBeNull();
  });

  it("gives each section an h2 that names it, followed by its text", () => {
    renderPage();
    const first = screen.getByRole("region", { name: "First part" });
    expect(within(first).getByRole("heading", { level: 2, name: "First part" })).toBeInTheDocument();
    expect(within(first).getByText("First body.")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Second part" })).getByText("Second body.")).toBeInTheDocument();
  });

  it("says in words that a page is a draft, and says nothing otherwise", () => {
    const { unmount } = renderPage({ draft: true });
    expect(screen.getByRole("note")).toHaveTextContent("Draft for Eduvos to review. Not yet in force.");
    unmount();
    renderPage();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("puts the contents list before the text, so on phones it sits under the lede", () => {
    const { container } = renderPage();
    const nav = container.querySelector(".info-toc")!;
    const body = container.querySelector(".info-body")!;
    expect(nav.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
