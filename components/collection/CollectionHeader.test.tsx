import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { getCollection } from "@/lib/data";
import { CollectionHeader } from "./CollectionHeader";

describe("CollectionHeader (shopping spec 7.2)", () => {
  it("shows the eyebrow, title, intro, who curated it and the count", async () => {
    render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={5} />);
    expect(screen.getByText("Moving in")).toHaveClass("eyebrow");
    expect(screen.getByRole("heading", { level: 1, name: "Res setup under R500" })).toBeInTheDocument();
    expect(screen.getByText("Make your room a home without breaking the bank.")).toBeInTheDocument();
    expect(screen.getByText("Curated by the Incubation Hub")).toBeInTheDocument();
    expect(screen.getByText("5 listings")).toBeInTheDocument();
  });

  it("keeps the photo out of the reading order: the title says what it is", async () => {
    const { container } = render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={5} />);
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("leaves the count out when the listings didn't load", async () => {
    render(<CollectionHeader collection={(await getCollection("moving-in"))!} count={null} />);
    expect(screen.queryByText(/listings?$/)).toBeNull();
  });
});
