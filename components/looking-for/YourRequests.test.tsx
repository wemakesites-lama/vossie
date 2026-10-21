import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequest } from "@/lib/data/requests";
import { resetSampleStore } from "@/lib/data/store";
import { YourRequests } from "./YourRequests";

const viewer = vi.hoisted(() => ({ account: null as null | { id: string } }));
const note = vi.hoisted(() => ({ notice: null as string | null }));

vi.mock("@/lib/auth/session", () => ({
  requireAccount: async (next: string) => {
    if (!viewer.account) throw new Error(`sign in, then ${next}`);
    return viewer.account;
  },
}));
vi.mock("@/lib/looking-for/form-state", () => ({
  takeNote: async () => (note.notice ? { notice: note.notice, values: {} } : null),
}));
vi.mock("@/lib/looking-for/actions", () => ({ closeMyRequest: async () => {}, reopenMyRequest: async () => {} }));

// It reads the clock after connection() (stage L): a stand-in here, and a fixed day in the tests that post requests.
vi.mock("next/server", () => ({ connection: async () => undefined }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-14T08:42:00.000Z"));
  resetSampleStore();
});

afterEach(() => {
  vi.useRealTimers();
  viewer.account = null;
  note.notice = null;
});

describe("Your requests for this visitor (community actions spec 2.13)", () => {
  it("lists only the visitor's own requests, with the last action's status line", async () => {
    await createRequest({
      askerId: "acc-student",
      fields: {
        title: "Desk lamp for res",
        categorySlug: "res-living",
        campusSlug: "midrand",
        details: "A lamp that clips onto a desk, by the weekend.",
        budgetZar: null,
        swapWelcome: false,
        neededBy: null,
      },
      now: new Date("2026-10-14T08:42:00.000Z"),
    });
    viewer.account = { id: "acc-student" };
    note.notice = "posted";
    render(await YourRequests());
    expect(screen.getByRole("link", { name: "Desk lamp for res" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your request is up.");
    expect(screen.queryByText("Accounting 1 tutor this week")).toBeNull();
  });

  it("sends a signed-out visitor to sign in, coming back here", async () => {
    await expect(YourRequests()).rejects.toThrow("sign in, then /account/requests");
  });
});
