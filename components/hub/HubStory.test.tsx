import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HubStory } from "./HubStory";

const banner = { src: "/placeholders/hub/banner.svg", alt: "" };

describe("HubStory (community spec 5.1)", () => {
  it("heads the page with the Hub's name and its story", () => {
    render(<HubStory image={banner} />);
    expect(screen.getByRole("heading", { level: 1, name: "The Incubation Hub" })).toBeInTheDocument();
    expect(screen.getByText(/backs student businesses on every campus/)).toBeInTheDocument();
    expect(screen.getByText(/The Hub also runs Vossie/)).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order", () => {
    const { container } = render(<HubStory image={banner} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });
});
