import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NO_FIT, type Pack } from "@/lib/browse/starter";
import type { StarterOutcome } from "@/lib/data/starter-pack";
import type { Campus } from "@/lib/types";
import { makeListing } from "@/tests/helpers/fakes";
import { StarterSkeleton, StarterView } from "./StarterPack";

const starter = vi.hoisted(() => ({
  outcome: { kind: "empty" } as StarterOutcome,
  calls: [] as [string | null, string][],
}));

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

vi.mock("@/lib/data/starter-pack", () => ({
  starterPackFor: async (sentence: string | null, campus: string) => {
    starter.calls.push([sentence, campus]);
    return starter.outcome;
  },
}));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: "midrand", signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  const campus = (slug: string, name: string) => ({ slug, name }) as Campus;
  return { ...actual, getCampuses: async () => [campus("midrand", "Midrand"), campus("pretoria", "Pretoria")] };
});

afterEach(() => {
  starter.outcome = { kind: "empty" };
  starter.calls.length = 0;
});

const view = async (params: Record<string, string>) =>
  render(await StarterView({ searchParams: Promise.resolve(params) }));

const calculator = makeListing({ id: "l-calc", title: "Casio calculator", priceZar: 250 });

function pack(overrides: Partial<Pack> = {}): Pack {
  return {
    lines: [
      {
        item: { name: "Calculator", words: "calculator", category: "tech" },
        kind: "pick",
        listing: calculator,
        seeMore: "/browse?q=calculator&exact=1",
      },
      {
        item: { name: "Bar fridge", words: "bar fridge", category: null },
        kind: "no-fit",
        reason: "budget",
        seeMore: "/browse?q=bar+fridge&exact=1",
      },
      { item: { name: "Kettle", words: "kettle", category: null }, kind: "none", ask: "/looking-for/new?title=Kettle" },
    ],
    total: 250,
    budget: 1000,
    fromPrices: false,
    ...overrides,
  };
}

describe("StarterView (AI round two spec section 6)", () => {
  it("shows only the form without a sentence", async () => {
    const { container } = await view({});
    const field = screen.getByRole("textbox", { name: "What do you need?" });
    expect(field).toHaveAttribute("name", "q");
    expect(field).toHaveAttribute("maxLength", "200");
    expect(field).toHaveValue("");
    expect(field).toHaveAccessibleDescription(/One sentence/);
    expect(screen.getByRole("button", { name: "Make my pack" })).toBeInTheDocument();
    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/browse/starter");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.queryByRole("heading", { name: "Your starter pack" })).not.toBeInTheDocument();
    expect(starter.calls).toEqual([[null, "midrand"]]);
  });

  it("shows the sentence as typed, trimmed and its spaces collapsed", async () => {
    await view({ q: "  Need a  Lamp " });
    expect(screen.getByRole("textbox", { name: "What do you need?" })).toHaveValue("Need a Lamp");
    expect(starter.calls).toEqual([["Need a Lamp", "midrand"]]);
  });

  it("lists the pack in order, with its links and total", async () => {
    starter.outcome = { kind: "pack", sentence: "Need stuff", pack: pack(), campus: "midrand" };
    await view({ q: "Need stuff" });
    expect(screen.getByRole("heading", { level: 2, name: "Your starter pack" })).toBeInTheDocument();
    expect(screen.getByText("At Midrand · Budget R1,000")).toBeInTheDocument();
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    ["Calculator", "Bar fridge", "Kettle"].forEach((name, n) => {
      expect(within(items[n]).getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(name);
    });
    expect(within(items[0]).getByRole("link", { name: "Casio calculator" })).toHaveAttribute("href", "/listings/l-calc");
    // The card's title sits under the item's h3, so it's an h4 (Task 5 review).
    expect(within(items[0]).getByRole("heading", { level: 4 })).toHaveTextContent("Casio calculator");
    expect(within(items[0]).getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(within(items[1]).getByText(NO_FIT.budget)).toBeInTheDocument();
    const more = screen.getByRole("link", { name: "See more (Calculator)" });
    expect(more).toHaveAttribute("href", "/browse?q=calculator&exact=1");
    expect(more.dataset.prefetch).toBe("false");
    const ask = screen.getByRole("link", { name: "Ask for it on Looking For (Kettle)" });
    expect(ask).toHaveAttribute("href", "/looking-for/new?title=Kettle");
    expect(ask.dataset.prefetch).toBe("false");
    expect(screen.getByText("Total R250 of your R1,000 budget, R750 left")).toBeInTheDocument();
    expect(screen.queryByText("Prices marked From can cost more.")).not.toBeInTheDocument();
  });

  it("names every campus and no budget", async () => {
    starter.outcome = { kind: "pack", sentence: "Need stuff", pack: pack({ budget: null }), campus: "all" };
    await view({ q: "Need stuff" });
    expect(screen.getByText("At every campus · No budget given")).toBeInTheDocument();
  });

  it("warns when a pick's price is a From price", async () => {
    starter.outcome = { kind: "pack", sentence: "Need stuff", pack: pack({ fromPrices: true }), campus: "midrand" };
    await view({ q: "Need stuff" });
    expect(screen.getByText("Prices marked From can cost more.")).toBeInTheDocument();
  });

  it("offers Shop with the sentence when the pack fails, keeping the form", async () => {
    starter.outcome = { kind: "failed", sentence: "Need a lamp" };
    await view({ q: "Need a lamp" });
    expect(screen.getByRole("heading", { level: 2, name: "We couldn't make a pack" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "What do you need?" })).toHaveValue("Need a lamp");
    expect(screen.getByRole("link", { name: "Search Shop for “Need a lamp”" })).toHaveAttribute(
      "href",
      "/browse?q=Need+a+lamp",
    );
  });
});

describe("StarterSkeleton", () => {
  it("is wordless and hidden from screen readers", () => {
    const { container } = render(<StarterSkeleton />);
    const root = container.firstElementChild;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root?.textContent).toBe("");
  });
});
