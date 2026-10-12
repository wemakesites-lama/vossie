import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Collections } from "./Collections";

describe("Collections (spec 7.6)", () => {
  it("is a section with a screen-reader heading and the four collections", async () => {
    render(await Collections());
    expect(
      screen.getByRole("region", { name: "Collections from the Incubation Hub" }),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Start of semester Back-to-campus essentials" })).toHaveAttribute(
      "href",
      "/collections/start-of-semester",
    );
  });

  it("keeps the photos decorative, since each title says it all", async () => {
    const { container } = render(await Collections());
    for (const image of container.querySelectorAll("img")) expect(image).toHaveAttribute("alt", "");
    expect(container.querySelector(".collections-stack")).toHaveAttribute("aria-hidden", "true");
  });
});
