import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WordsLine } from "./WordsLine";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("WordsLine (AI features spec 6)", () => {
  it("says what the search used, with a link to search the words exactly, never prefetched", () => {
    const { container } = render(
      <WordsLine line="Showing calculator under R500 at Midrand." exactHref="/browse?q=calculator+under+r300&exact=1" />,
    );
    const line = container.querySelector("p.browse-words");
    expect(line).toHaveTextContent("Showing calculator under R500 at Midrand. Search for exactly what I typed");
    const link = screen.getByRole("link", { name: "Search for exactly what I typed" });
    expect(link).toHaveAttribute("href", "/browse?q=calculator+under+r300&exact=1");
    expect(link.dataset.prefetch).toBe("false");
  });
});
