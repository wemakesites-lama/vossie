import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { messageHrefFor, reportHrefFor } from "./links";

const viewer = vi.hoisted(() => ({ account: null as { id: string } | null }));

vi.mock("@/lib/auth/session", () => ({ getViewer: async () => viewer.account }));

beforeEach(() => {
  resetSampleStore();
});

afterEach(() => {
  viewer.account = null;
});

describe("where Message seller goes (messaging spec 2.1, 2.2 and 3.6; plan decisions 3 and 5)", () => {
  it("goes through sign-in to the composer when signed out", async () => {
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/login?next=%2Flistings%2Fl-001%2Fmessage");
    expect(await messageHrefFor({ kind: "shop", sellerSlug: "tech-corner" })).toBe(
      "/login?next=%2Fsellers%2Ftech-corner%2Fmessage",
    );
  });

  it("goes to the visitor's thread about the listing when there is one, otherwise the composer", async () => {
    viewer.account = { id: "acc-student" };
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/messages/conv-s2");
    expect(await messageHrefFor({ kind: "shop", sellerSlug: "tech-corner" })).toBe("/sellers/tech-corner/message");
    viewer.account = { id: "acc-mentor" };
    expect(await messageHrefFor({ kind: "listing", listingId: "l-001" })).toBe("/listings/l-001/message");
  });
});

describe("where Report goes (messaging spec 2.8 and 3.6)", () => {
  it("goes through sign-in to the form when signed out, and straight to it when signed in", async () => {
    const target = { kind: "listing", id: "l-001" } as const;
    expect(await reportHrefFor(target)).toBe("/login?next=%2Freport%3Flisting%3Dl-001");
    viewer.account = { id: "acc-mentor" };
    expect(await reportHrefFor(target)).toBe("/report?listing=l-001");
  });
});
