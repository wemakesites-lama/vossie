import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import { resetSampleStore } from "@/lib/data/store";
import { redirectOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { getShopOwner, requireShopOwner } from "./owner";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());

const NOW = new Date("2026-10-14T08:42:00.000Z");
const IN_30_DAYS = new Date("2026-11-13T08:42:00.000Z");

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

async function signedInAs(accountId: string) {
  await createSession({ key: hashToken("token-1"), accountId, createdAt: NOW, expiresAt: IN_30_DAYS });
  request.cookies.set(SESSION_COOKIE, "token-1");
}

describe("the owner check (selling spec section 3)", () => {
  it("gives the signed-in seller their own shop, and its status", async () => {
    await signedInAs("acc-seller");
    const owner = await requireShopOwner("/sell/profile");
    expect([owner.account.id, owner.shop.slug, owner.status]).toEqual(["acc-seller", "tech-corner", "approved"]);
    expect((await getShopOwner())?.shop.slug).toBe("tech-corner");
  });

  it("sends a student with no shop to the pitch", async () => {
    await signedInAs("acc-student");
    expect(await redirectOf(() => requireShopOwner("/sell/profile"))).toBe("/sell");
    expect(await getShopOwner()).toBeNull();
  });

  it("sends anyone signed out to sign in, coming back only to a path on this site", async () => {
    expect(await redirectOf(() => requireShopOwner("/sell/profile"))).toBe("/login?next=%2Fsell%2Fprofile");
    expect(await redirectOf(() => requireShopOwner("//evil.example/sell"))).toBe("/login?next=%2Fsell");
    expect(await redirectOf(() => requireShopOwner("https://evil.example"))).toBe("/login?next=%2Fsell");
    expect(await getShopOwner()).toBeNull();
  });
});
