import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import MentorShopPage from "./page";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("@/lib/staff/mentor-actions", () => ({ addMentorNote: async () => {}, addCheckIn: async () => {} }));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

/** The page's request-time part, run on its own: jsdom can't render an async component inside a tree. */
async function open(slug: string): Promise<unknown> {
  const page = MentorShopPage({ params: Promise.resolve({ slug }) } as never) as ReactElement<{
    children: ReactElement<Record<string, unknown>>;
  }>;
  const shop = page.props.children;
  return (shop.type as (props: Record<string, unknown>) => Promise<unknown>)(shop.props);
}

describe("a shop's mentor page (staff tools spec 2.6)", () => {
  it("opens for the shop's mentor and for an admin", async () => {
    await signedInAs(request, "acc-mentor");
    await expect(open("tech-corner")).resolves.toBeTruthy();
    await signedInAs(request, "acc-admin");
    await expect(open("tech-corner")).resolves.toBeTruthy();
  });

  it("sends a signed-out visitor to sign in, and gives a student, another mentor, or a shop with none the 404", async () => {
    await expect(redirectOf(() => open("tech-corner"))).resolves.toBe("/login?next=%2Fmentor%2Ftech-corner");
    await signedInAs(request, "acc-student");
    await expect(open("tech-corner")).rejects.toThrow("notFound");
    await signedInAs(request, "acc-mentor");
    await expect(open("hair-studio")).rejects.toThrow("notFound");
    await expect(open("nothing-here")).rejects.toThrow("notFound");
  });

  it("gives the 404 for the viewer's own shop, whether they are its mentor or an admin (amendment 15.3)", async () => {
    // Notes are about a shop's owner, so nobody reads them about themselves.
    sampleStore().accounts.get("acc-seller")!.roles.push("mentor");
    sampleStore().sellerProfiles.get("acc-seller")!.mentorId = "acc-seller";
    await signedInAs(request, "acc-seller");
    await expect(open("tech-corner")).rejects.toThrow("notFound");
    sampleStore().accounts.get("acc-seller")!.roles.push("admin");
    await expect(open("tech-corner")).rejects.toThrow("notFound");
    // An admin who doesn't own it still reads it.
    await signedInAs(request, "acc-admin");
    await expect(open("tech-corner")).resolves.toBeTruthy();
  });
});
