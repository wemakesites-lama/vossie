import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Photo } from "@/components/listings/Photo";
import { SectionError } from "./SectionError";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("makes the title the H2 when there is one, with the eyebrow above it", () => {
    render(<SectionHeader id="just-listed" eyebrow="Just listed" title="New at Midrand" />);
    const heading = screen.getByRole("heading", { level: 2, name: "New at Midrand" });
    expect(heading).toHaveAttribute("id", "just-listed-title");
    expect(screen.getByText("Just listed")).toHaveClass("eyebrow");
  });

  it("makes the eyebrow itself the H2 when there's no title", () => {
    render(<SectionHeader id="categories" eyebrow="Shop by category" />);
    expect(screen.getByRole("heading", { level: 2, name: "Shop by category" })).toHaveClass("eyebrow");
  });

  it("gives its link extra words for screen readers, so two 'See all' links differ", () => {
    render(<SectionHeader id="x" eyebrow="X" link={{ href: "/browse", label: "See all", context: " new listings" }} />);
    expect(screen.getByRole("link", { name: "See all new listings" })).toHaveAttribute("href", "/browse");
  });

  it("uses navy eyebrows on grey, pale and sky panels", () => {
    render(<SectionHeader id="x" eyebrow="Free & swaps" title="Pass it on" tone="navy" />);
    expect(screen.getByText("Free & swaps")).toHaveClass("text-navy");
  });
});

describe("Photo", () => {
  it("shows the image in a fixed-ratio box", () => {
    const { container } = render(
      <Photo image={{ src: "/placeholders/campus/midrand.svg", alt: "Midrand campus" }} ratio="1 / 1" sizes="300px" />,
    );
    expect(screen.getByRole("img", { name: "Midrand campus" })).toHaveAttribute("src", "/placeholders/campus/midrand.svg");
    // A custom property, which jsdom keeps (it drops aspect-ratio itself).
    expect(container.querySelector<HTMLElement>(".photo")!.style.getPropertyValue("--photo-ratio")).toBe("1 / 1");
  });
});

describe("SectionError", () => {
  it("says what didn't load and offers a reload that comes back to the section", () => {
    render(<SectionError id="just-listed" title="Just listed" />);
    expect(screen.getByText("Just listed didn't load.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/?retry=just-listed#just-listed");
  });

  it("comes back to the page it's on, when given one", () => {
    render(<SectionError id="more-from" title="More listings" path="/listings/l-001" />);
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute(
      "href",
      "/listings/l-001?retry=more-from#more-from",
    );
  });
});
