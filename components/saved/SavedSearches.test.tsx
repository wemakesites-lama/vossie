import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSavedSearch } from "@/lib/data/saved-searches";
import { resetSampleStore } from "@/lib/data/store";
import type { MatchQuery } from "@/lib/types";
import { SavedSearches } from "./SavedSearches";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({
  forms: [] as string[],
  state: null as null | { notice: string | null; errors: string[]; values: Record<string, string> },
}));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async (form: string) => {
    note.forms.push(form);
    return note.state;
  },
}));
vi.mock("@/lib/saved-searches/actions", () => ({
  deleteSearch: async () => {},
  pauseSearchAlerts: async () => {},
  resumeSearchAlerts: async () => {},
}));

const search = (overrides: Partial<MatchQuery>): MatchQuery => ({
  q: null,
  category: null,
  campus: "all",
  price: null,
  pay: null,
  deals: null,
  ...overrides,
});

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.forms = [];
  note.state = null;
});

describe("the Searches tab, for this visitor (search alerts spec 2.7)", () => {
  it("lists the visitor's saved searches, newest first, with the tab's last status line", async () => {
    await addSavedSearch("acc-student", search({ q: "calculator", campus: "midrand" }), new Date("2026-10-12T07:40:00Z"));
    await addSavedSearch("acc-student", search({ category: "tech" }), new Date("2026-10-13T07:40:00Z"));
    await addSavedSearch("acc-mentor", search({ q: "lamp" }), new Date("2026-10-13T07:40:00Z"));
    viewer.account = { id: "acc-student" };
    note.state = {
      notice: "resumed",
      errors: [],
      values: { label: "Tech at every campus", href: "/browse?cat=tech&campus=all" },
    };
    render(await SavedSearches());
    const labels = screen.getAllByRole("listitem").map((row) => row.querySelector("a")?.textContent);
    expect(labels).toEqual(["Tech at every campus", "“calculator” at Midrand"]);
    expect(screen.getByRole("status")).toHaveTextContent("Alerts on for Tech at every campus.");
    expect(note.forms).toEqual(["saved-searches"]);
  });

  it("asks a signed-out visitor to sign in, taking no status line", async () => {
    render(await SavedSearches());
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(note.forms).toEqual([]);
  });
});
