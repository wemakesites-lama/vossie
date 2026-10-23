import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YourRequestsLink } from "./YourRequestsLink";

vi.mock("next/link", async () => (await import("@/tests/helpers/next-link")).nextLinkShowingPrefetch);

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null, open: 0, failing: false }));
vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));
vi.mock("@/lib/data/requests", () => ({
  countOpenRequests: async () => {
    if (viewer.failing) throw new Error("The store didn't answer");
    return viewer.open;
  },
}));

afterEach(() => {
  viewer.account = null;
  viewer.open = 0;
  viewer.failing = false;
});

describe("Your requests on the board (role views spec 7.4)", () => {
  it("is nothing signed out", async () => {
    expect(await YourRequestsLink()).toBeNull();
  });

  it("is nothing with no open request, or when the count fails", async () => {
    viewer.account = { id: "acc-student" };
    expect(await YourRequestsLink()).toBeNull();
    viewer.open = 2;
    viewer.failing = true;
    expect(await YourRequestsLink()).toBeNull();
  });

  it("links an asker to Your requests with the open count, with no prefetch", async () => {
    viewer.account = { id: "acc-student" };
    viewer.open = 2;
    render((await YourRequestsLink())!);
    const link = screen.getByRole("link", { name: "Your requests (2 open)" });
    expect(link).toHaveAttribute("href", "/account/requests");
    expect(link.dataset.prefetch).toBe("false");
  });
});
