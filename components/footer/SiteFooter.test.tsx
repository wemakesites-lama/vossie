import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { setCampusChoice } from "@/lib/campus";
import type { Campus } from "@/lib/types";
import { SiteFooter } from "./SiteFooter";

const campuses: Campus[] = [
  { slug: "midrand", name: "Midrand", region: "Gauteng", liveListings: 5, image: { src: "/p.svg", alt: "" } },
  { slug: "online", name: "Eduvos Online", region: "Online, anywhere in SA", liveListings: 5, image: { src: "/p.svg", alt: "" } },
];

describe("SiteFooter", () => {
  it("leads with two giant links", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/browse");
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("sends 'Shop your campus' to the chosen campus", () => {
    setCampusChoice("midrand");
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getByRole("link", { name: "Shop your campus" })).toHaveAttribute("href", "/c/midrand");
  });

  it("links every campus, the privacy notice and the sign-up", () => {
    render(<SiteFooter campuses={campuses} />);
    expect(screen.getAllByRole("link", { name: "Eduvos Online" })[0]).toHaveAttribute("href", "/c/online");
    expect(screen.getAllByRole("link", { name: "Privacy (POPIA)" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("textbox", { name: "Email address" })).toBeInTheDocument();
  });

  it("credits the Incubation Hub and hides the decorative wordmark from screen readers", () => {
    const { container } = render(<SiteFooter campuses={campuses} />);
    expect(screen.getByText("An Eduvos Incubation Hub project")).toBeInTheDocument();
    expect(container.querySelector(".footer-wordmark")).toHaveAttribute("aria-hidden", "true");
  });
});
