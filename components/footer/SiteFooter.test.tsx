import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import type { Campus } from "@/lib/types";
import { SiteFooter } from "./SiteFooter";

// next/link draws a plain <a> in jsdom and keeps `prefetch` to itself, so in this file Link shows it as data-prefetch:
// "auto" when the link says nothing (Next's default) and otherwise the value it was given.
vi.mock("next/link", () => ({
  default: ({
    href,
    prefetch,
    children,
    ...rest
  }: {
    href: string;
    prefetch?: boolean | null;
    children?: ReactNode;
    className?: string;
  }) => (
    <a href={href} data-prefetch={prefetch === undefined ? "auto" : String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "online", name: "Eduvos Online", region: "Online, anywhere in SA", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];

/** The distinct addresses of every footer link with this name. The legal list repeats some of the columns' links. */
const hrefsOf = (name: string) => [
  ...new Set(screen.getAllByRole("link", { name }).map((link) => link.getAttribute("href"))),
];

describe("SiteFooter", () => {
  it("leads with two giant links", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("keeps 'Shop your campus' on /browse, which opens on the chosen campus (plan decision 12)", () => {
    setCampusChoice("midrand");
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/browse");
  });

  it("links every campus, the privacy notice and the sign-up", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getAllByRole("link", { name: "Eduvos Online" })[0]).toHaveAttribute("href", "/browse?campus=online");
    expect(screen.getAllByRole("link", { name: "Privacy (POPIA)" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
  });

  it("links the info and legal pages (info and system spec 2.11)", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(hrefsOf("Seller guidelines")).toEqual(["/seller-guidelines"]);
    expect(hrefsOf("How trust works")).toEqual(["/trust"]);
    expect(hrefsOf("Terms of use")).toEqual(["/terms"]);
    expect(hrefsOf("Privacy (POPIA)")).toEqual(["/privacy"]);
    expect(hrefsOf("Safety")).toEqual(["/safety"]);
    expect(screen.queryByRole("link", { name: "Seller safety" })).toBeNull();
  });

  it("ends with the info list: six links on phones, the three legal ones from the wide step", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const list = container.querySelector<HTMLElement>("ul.footer-legal-links")!;
    expect(within(list).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "How it works",
      "How trust works",
      "Seller guidelines",
      "Privacy (POPIA)",
      "Terms of use",
      "Safety",
    ]);
    // The Help and Sell columns hold the first three from the wide step, so the list hides them there.
    const phoneOnly = [...list.querySelectorAll("li")].map((item) => item.classList.contains("wide:hidden"));
    expect(phoneOnly).toEqual([true, true, true, false, false, false]);
  });

  it("puts the info list before the lockup, so phones read the links first", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const legal = container.querySelector<HTMLElement>(".footer-legal")!;
    expect([...legal.children].map((child) => child.className)).toEqual(["footer-legal-links", "footer-lock"]);
  });

  it("doesn't prefetch Saved, which would download its route chunk on every page once the footer scrolls into view", () => {
    render(<SiteFooter campuses={campuses} />);
    const saved = screen.getAllByRole("link", { name: "Saved" });
    expect(saved.length).toBeGreaterThan(0);
    for (const link of saved) expect(link).toHaveAttribute("data-prefetch", "false");
    // The other links keep Next's default, so only this one changed.
    expect(screen.getAllByRole("link", { name: "Browse everything" })[0]).toHaveAttribute("data-prefetch", "auto");
  });

  it("credits the Incubation Hub and hides the decorative wordmark from screen readers", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    expect(screen.getByText("An Eduvos Incubation Hub project")).toBeInTheDocument();
    expect(container.querySelector(".footer-wordmark")).toHaveAttribute("aria-hidden", "true");
  });

  it("sets the campuses in two columns, once (decision 17)", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    const columns = container.querySelectorAll<HTMLElement>(".footer-links-columns");
    expect(columns).toHaveLength(1);
    expect(within(columns[0]).getAllByRole("link")).toHaveLength(campuses.length);
  });

  it("has no accordions, and hides the giant links and the link columns below the wide step (phone footer spec 3.1)", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector(".footer-giants")).toHaveClass("hidden", "wide:grid");
    const groups = container.querySelectorAll(".footer-group");
    expect(groups).toHaveLength(4);
    for (const group of groups) expect(group).toHaveClass("hidden", "wide:block");
  });
});
