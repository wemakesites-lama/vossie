import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { addFollow, isFollowing } from "@/lib/data/follows";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { followShop, unfollowShop } from "./actions";
import { followNoteKey, SAVED_SHOPS_FORM } from "./rules";

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));

vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));

beforeEach(() => {
  resetSampleStore();
  resetRequest(request);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(STAFF_NOW);
});

describe("Follow and Unfollow (community actions spec 2.16 and 2.17)", () => {
  it("follows from the band, landing back on the storefront with a status line", async () => {
    await signedInAs(request, "acc-student");
    const redirect = await redirectSignalOf(() => followShop(form({ shop: "tech-corner" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/sellers/tech-corner", "replace", true]);
    expect(await isFollowing("acc-student", "tech-corner")).toBe(true);
    expect(await readFormState(followNoteKey("tech-corner"))).toMatchObject({
      notice: "followed",
      values: { shop: "Tech corner" },
    });
  });

  it("unfollows from Saved, landing back on its Shops tab with a status line", async () => {
    await signedInAs(request, "acc-student");
    await addFollow("acc-student", "tech-corner", STAFF_NOW);
    expect(await redirectOf(() => unfollowShop(form({ shop: "tech-corner", from: "saved" })))).toBe("/saved?tab=shops");
    expect(await isFollowing("acc-student", "tech-corner")).toBe(false);
    expect(await readFormState(SAVED_SHOPS_FORM)).toMatchObject({
      notice: "unfollowed",
      values: { shop: "Tech corner" },
    });
  });

  it("quietly refuses the owner's own shop, and says when 200 is reached", async () => {
    await signedInAs(request, "acc-seller");
    await redirectOf(() => followShop(form({ shop: "tech-corner" })));
    expect(await isFollowing("acc-seller", "tech-corner")).toBe(false);
    expect(await readFormState(followNoteKey("tech-corner"))).toBeNull();
    for (let n = 0; n < 200; n += 1) {
      sampleStore().follows.set(`follow-${n}`, {
        id: `follow-${n}`,
        accountId: "acc-student",
        sellerSlug: `shop-${n}`,
        createdAt: STAFF_NOW.toISOString(),
      });
    }
    await signedInAs(request, "acc-student");
    await redirectOf(() => followShop(form({ shop: "code-coach" })));
    expect(await isFollowing("acc-student", "code-coach")).toBe(false);
    expect(await readFormState(followNoteKey("code-coach"))).toMatchObject({ notice: "follow-limit" });
  });

  it("sends a signed-out visitor to sign in, coming back to the shop; a made-up slug goes home", async () => {
    expect(await redirectOf(() => followShop(form({ shop: "tech-corner" })))).toBe("/login?next=%2Fsellers%2Ftech-corner");
    expect(await redirectOf(() => followShop(form({ shop: "Not a slug!" })))).toBe("/");
    expect(sampleStore().follows.size).toBe(0);
  });
});
