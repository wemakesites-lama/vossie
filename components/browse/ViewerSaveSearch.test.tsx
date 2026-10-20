import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addSavedSearch } from "@/lib/data/saved-searches";
import { resetSampleStore } from "@/lib/data/store";
import type { MatchQuery } from "@/lib/types";
import { ViewerSaveSearch } from "./ViewerSaveSearch";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({
  forms: [] as string[],
  state: null as null | { notice: string | null; errors: string[]; values: Record<string, string> },
}));
const issued = vi.hoisted(() => ({ count: 0 }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async (form: string) => {
    note.forms.push(form);
    return note.state;
  },
}));
vi.mock("@/lib/staff/once", () => ({
  issueOnceToken: async () => {
    issued.count += 1;
    return "t";
  },
}));
vi.mock("@/lib/saved-searches/actions", () => ({ saveThisSearch: async () => {} }));

const SEARCH: MatchQuery = { q: "calculator", category: null, campus: "midrand", price: null, pay: null, deals: null };
const FROM = "/browse?q=calculator&campus=midrand";

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
  note.forms = [];
  note.state = null;
  issued.count = 0;
});

describe("Save this search, once the session is read (search alerts spec 2.6)", () => {
  it("is the sign-in link when signed out, taking no status line and no token", async () => {
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("link", { name: "Save this search" })).toHaveAttribute(
      "href",
      "/login?next=%2Fbrowse%3Fq%3Dcalculator%26campus%3Dmidrand",
    );
    expect(note.forms).toEqual([]);
    expect(issued.count).toBe(0);
  });

  it("is the button with a token, then says it's saved once the account has the same search", async () => {
    viewer.account = { id: "acc-student" };
    const { unmount } = render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("button", { name: "Save this search" })).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('input[name="once"]')?.value).toBe("t");
    expect(issued.count).toBe(1);
    unmount();
    await addSavedSearch("acc-student", { ...SEARCH, q: "Calculator" }, new Date("2026-10-14T08:42:00.000Z"));
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByText("You've saved this search.")).toBeInTheDocument();
    expect(issued.count).toBe(1);
  });

  it("takes this search's own status line, once", async () => {
    viewer.account = { id: "acc-student" };
    note.state = { notice: "saved", errors: [], values: {} };
    render(await ViewerSaveSearch({ search: SEARCH, from: FROM }));
    expect(screen.getByRole("status")).toHaveTextContent("Search saved.");
    expect(note.forms).toEqual(["save-search:calculator||midrand|||"]);
  });
});
