import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { makeBrowseQuery } from "@/tests/helpers/fakes";
import { BrowseEmpty } from "./BrowseEmpty";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

describe("BrowseEmpty (spec 4.7)", () => {
  it("always offers Looking For", () => {
    render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here yet" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ask for it on Looking For" })).toHaveAttribute("href", "/looking-for");
    expect(screen.queryByText(/spelling/)).not.toBeInTheDocument();
  });

  it("suggests checking the spelling after a search", () => {
    render(<BrowseEmpty query={makeBrowseQuery({ q: "zebra", sort: "match" })} elsewhere={0} />);
    expect(screen.getByText("Check the spelling, or try a shorter word.")).toBeInTheDocument();
  });

  it("points to other campuses that have matches", () => {
    const { rerender } = render(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={36} />);
    expect(screen.getByRole("link", { name: "36 more at other campuses" })).toHaveAttribute("href", "/browse?campus=all");
    rerender(<BrowseEmpty query={makeBrowseQuery({ campus: "mbombela" })} elsewhere={1} />);
    expect(screen.getByRole("link", { name: "1 more at another campus" })).toBeInTheDocument();
  });

  it("offers to clear the filters, keeping the campus", () => {
    render(
      <BrowseEmpty
        query={makeBrowseQuery({ campus: "midrand", campusFromLink: true, price: "free" })}
        elsewhere={0}
      />,
    );
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/browse?campus=midrand");
  });
});

describe("BrowseEmpty's Snap to search links (AI features spec section 5, stage D planning decision 3)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers Search with a photo only while Snap to search is on, never prefetched", () => {
    vi.stubEnv("VOSSIE_AI_PHOTO_SEARCH", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    const { unmount } = render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    const link = screen.getByRole("link", { name: "Search with a photo" });
    expect(link).toHaveAttribute("href", "/browse/photo");
    expect(link.dataset.prefetch).toBe("false");
    unmount();
    vi.stubEnv("VOSSIE_AI_PHOTO_SEARCH", "");
    render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    expect(screen.queryByRole("link", { name: "Search with a photo" })).not.toBeInTheDocument();
  });

  it("asks on Looking For with the search words as the title, never prefetched", () => {
    render(<BrowseEmpty query={makeBrowseQuery({ q: "casio calculator", sort: "match" })} elsewhere={0} />);
    const link = screen.getByRole("link", { name: "Ask for it on Looking For" });
    expect(link).toHaveAttribute("href", "/looking-for/new?title=casio%20calculator");
    expect(link.dataset.prefetch).toBe("false");
  });
});

describe("BrowseEmpty's starter pack link (AI round two spec section 6, stage H planning decision 12)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("offers a starter pack only while the feature is on, between the photo search and Looking For, never prefetched", () => {
    vi.stubEnv("VOSSIE_AI_STARTER_PACK", "1");
    vi.stubEnv("VOSSIE_AI_PHOTO_SEARCH", "1");
    vi.stubEnv("VOSSIE_AI_PROVIDERS", "fake");
    const { unmount } = render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    const link = screen.getByRole("link", { name: "Get a starter pack" });
    expect(link).toHaveAttribute("href", "/browse/starter");
    expect(link.dataset.prefetch).toBe("false");
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names.indexOf("Search with a photo")).toBeLessThan(names.indexOf("Get a starter pack"));
    expect(names.indexOf("Get a starter pack")).toBeLessThan(names.indexOf("Ask for it on Looking For"));
    unmount();
    vi.stubEnv("VOSSIE_AI_STARTER_PACK", "");
    render(<BrowseEmpty query={makeBrowseQuery()} elsewhere={0} />);
    expect(screen.queryByRole("link", { name: "Get a starter pack" })).not.toBeInTheDocument();
  });
});
