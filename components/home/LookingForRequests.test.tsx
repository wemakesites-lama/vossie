import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LookingForRequests } from "./LookingForRequests";

const viewer = vi.hoisted(() => ({ campus: "midrand" }));
const requests = vi.hoisted(() => ({ mode: "real" as "real" | "empty" | "failing" }));

vi.mock("@/lib/data/viewer", () => ({
  getViewerContext: async () => ({ campus: viewer.campus, signedIn: false, activity: null }),
}));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return {
    ...actual,
    getRequests: async (query: Parameters<typeof actual.getRequests>[0]) => {
      if (requests.mode === "failing") throw new Error("The requests didn't load");
      return requests.mode === "empty" ? [] : actual.getRequests(query);
    },
  };
});

afterEach(() => {
  requests.mode = "real";
});

describe("LookingForRequests", () => {
  it("lists three open requests, the campus's own first, with their offers", async () => {
    viewer.campus = "midrand";
    render(await LookingForRequests());
    const rows = within(screen.getByRole("list", { name: "Open requests" })).getAllByRole("link");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Accounting 1 tutor this week Midrand · 2 offers",
      "Birthday cake for Friday Midrand · 3 offers",
      "Graphic calculator to borrow for exams Pretoria · 1 offer",
    ]);
    expect(rows[0]).toHaveAttribute("href", "/looking-for");
  });

  it("invites the first request when there are none", async () => {
    requests.mode = "empty";
    render(await LookingForRequests());
    expect(screen.getByText("No open requests yet. Be the first to ask.")).toBeInTheDocument();
  });

  it("shows its own error state when the requests don't load", async () => {
    requests.mode = "failing";
    render(await LookingForRequests());
    expect(screen.getByText("Open requests didn't load.")).toBeInTheDocument();
  });
});
