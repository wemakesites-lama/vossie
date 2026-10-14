import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readSavedIds, savedCookieString } from "@/lib/saved";
import { SavedList } from "./SavedList";

const saved = vi.hoisted(() => ({ ids: [] as string[], failing: false }));

vi.mock("@/lib/data/saved", () => ({ getSavedIds: async () => saved.ids }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getListingsByIds: async (ids: readonly string[]) => {
      if (saved.failing) throw new Error("Didn't load");
      return actual.getListingsByIds(ids);
    },
  };
});

afterEach(() => {
  saved.ids = [];
  saved.failing = false;
});

describe("SavedList (shopping spec 5.2)", () => {
  it("counts the saved listings and shows them in saved order, 5 across on desktop", async () => {
    saved.ids = ["l-007", "l-001"];
    render(await SavedList());
    expect(screen.getByText("2 saved")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Gaming headset, barely used",
      "Casio fx-991ZA Plus calculator",
    ]);
    expect(screen.getByRole("list")).toHaveAttribute("data-columns", "five");
  });

  it("keeps sold and paused listings, tagged, and drops ids that no longer exist", async () => {
    saved.ids = ["l-026", "gone", "l-016"];
    render(await SavedList());
    expect(screen.getByText("2 saved")).toBeInTheDocument();
    expect(screen.getByText("Sold")).toBeInTheDocument();
    expect(screen.getByText("Not taking orders")).toBeInTheDocument();
  });

  it("forgets the ids that have no listing, in the empty state too, so the cookie stops carrying them", async () => {
    saved.ids = ["l-026", "gone", "l-016"];
    document.cookie = savedCookieString(saved.ids, false);
    const { unmount } = render(await SavedList());
    expect(readSavedIds()).toEqual(["l-026", "l-016"]);
    unmount();

    saved.ids = ["gone-1", "gone-2"];
    document.cookie = savedCookieString(saved.ids, false);
    render(await SavedList());
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeInTheDocument();
    expect(readSavedIds()).toEqual([]);
  });

  it("starts every heart pressed in the server's HTML (spec 5.3)", async () => {
    saved.ids = ["l-001", "l-007"];
    const html = renderToString(await SavedList());
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2);
  });

  it("shows the empty state when nothing is saved", async () => {
    render(await SavedList());
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeInTheDocument();
    expect(screen.getByText("Tap the heart on any listing to keep it here.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start browsing" })).toHaveAttribute("href", "/browse");
    expect(screen.queryByText(/saved$/)).toBeNull();
  });

  it("shows the empty state when nothing saved exists any more", async () => {
    saved.ids = ["gone"];
    render(await SavedList());
    expect(screen.getByRole("heading", { level: 2, name: "Nothing saved yet" })).toBeInTheDocument();
  });

  it("says when the list couldn't load, with a way to try again (spec 5.4)", async () => {
    saved.ids = ["l-001"];
    saved.failing = true;
    render(await SavedList());
    expect(screen.getByText("We couldn't load your saved listings just now.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/saved");
  });
});
