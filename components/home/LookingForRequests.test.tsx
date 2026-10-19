import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
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

// Requests come from the sample store (community actions plan decision 1). A fresh one for each test.
beforeEach(() => {
  resetSampleStore();
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
    // Each row opens its own request (community spec 4.3).
    expect(rows.map((row) => row.getAttribute("href"))).toEqual([
      "/looking-for/r-001",
      "/looking-for/r-003",
      "/looking-for/r-002",
    ]);
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
