import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HubIntro } from "./HubIntro";

describe("HubIntro (Launchpad spec 4.1)", () => {
  it("heads the page with Launchpad, what it's for, and the two things to do", () => {
    render(<HubIntro />);
    expect(screen.getByRole("heading", { level: 1, name: "Launchpad" })).toBeInTheDocument();
    expect(screen.getByText(/Free help to start and grow your business on campus/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Book office hours" })).toHaveAttribute(
      "href",
      "/hub?type=office-hours#hub-coming-up",
    );
    expect(screen.getByRole("link", { name: "Start selling" })).toHaveAttribute("href", "/sell");
  });

  it("has no photo", () => {
    const { container } = render(<HubIntro />);
    expect(container.querySelector("img")).toBeNull();
  });
});
