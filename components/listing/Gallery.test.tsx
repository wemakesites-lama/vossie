import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeListing } from "@/tests/helpers/fakes";
import { Gallery } from "./Gallery";

const threePhotos = makeListing({
  title: "Casio calculator",
  image: { src: "/placeholders/listing/tech.svg", alt: "Casio calculator" },
  morePhotos: [
    { src: "/placeholders/photo/2.svg", alt: "The back" },
    { src: "/placeholders/photo/3.svg", alt: "The cover" },
  ],
});

describe("Gallery (spec 5.6)", () => {
  it("puts several photos in a labelled region you can scroll from the keyboard", () => {
    render(<Gallery listing={threePhotos} />);
    const region = screen.getByRole("region", { name: "Photos" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getAllByRole("img").map((image) => image.getAttribute("alt"))).toEqual([
      "Casio calculator. Photo 1 of 3",
      "The back. Photo 2 of 3",
      "The cover. Photo 3 of 3",
    ]);
  });

  it("loads the cover first and the rest lazily", () => {
    render(<Gallery listing={threePhotos} />);
    const images = within(screen.getByRole("region", { name: "Photos" })).getAllByRole("img");
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "lazy");
  });

  it("keeps the extra photos behind a button for data saver", () => {
    const { container } = render(<Gallery listing={threePhotos} />);
    expect(container.querySelector(".gallery-saver > summary")).toHaveTextContent("Show 2 more photos");
  });

  it("is a single photo with no region or count when there's only the cover", () => {
    const { container } = render(<Gallery listing={makeListing({ title: "Kettle" })} />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Test listing");
    expect(container.querySelector(".gallery-saver")).toBeNull();
  });
});
