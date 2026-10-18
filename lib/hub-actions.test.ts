import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { hasRsvp, publishedPost } from "@/lib/data/hub-posts";
import { getNotifications } from "@/lib/data/notifications";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { HUB_NOTICE, slotForm } from "@/lib/staff/form-state";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { cancelRsvp, rsvpToEvent, sendSlotRequest } from "./hub-actions";

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

const hubNotice = async () => (await readFormState(HUB_NOTICE))?.notice ?? null;

describe("RSVP (staff tools spec 2.5, plan decision 13)", () => {
  it("sends a signed-out visitor to sign in, coming back to the post", async () => {
    expect(await redirectOf(() => rsvpToEvent(form({ post: "h-001" })))).toBe("/login?next=%2Fhub%2Fh-001");
  });

  it("adds the student once, counts them, and says so on the post; Cancel takes it back", async () => {
    await signedInAs(request, "acc-student");
    const redirect = await redirectSignalOf(() => rsvpToEvent(form({ post: "h-001" })));
    expect([redirect.url, redirect.type, request.refreshed]).toEqual(["/hub/h-001", "replace", true]);
    expect(await hasRsvp("h-001", "acc-student")).toBe(true);
    expect(publishedPost("h-001")?.going).toBe(13);
    expect(request.updatedTags).toEqual(["hub"]);
    expect(await hubNotice()).toBe("rsvp");
    await redirectOf(() => cancelRsvp(form({ post: "h-001" })));
    expect(await hasRsvp("h-001", "acc-student")).toBe(false);
    expect(await hubNotice()).toBe("rsvp-cancelled");
  });

  it("says a full event is full, adding nobody", async () => {
    sampleStore().hubPosts.get("h-003")!.going = 40;
    await signedInAs(request, "acc-student");
    await redirectOf(() => rsvpToEvent(form({ post: "h-003" })));
    expect(await hasRsvp("h-003", "acc-student")).toBe(false);
    expect(await hubNotice()).toBe("event-full");
    expect(request.updatedTags).toEqual([]);
  });
});

describe("Request a slot (staff tools spec 2.5, plan decision 13)", () => {
  it("sends a signed-out visitor to sign in, coming back to the request page", async () => {
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: "Prices" })))).toBe(
      "/login?next=%2Fhub%2Fh-002%2Fbook",
    );
  });

  it("asks what they'd like help with, keeping what was typed", async () => {
    await signedInAs(request, "acc-seller");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: " ", time: "t".repeat(101) })))).toBe(
      "/hub/h-002/book",
    );
    expect(await readFormState(slotForm("h-002"))).toMatchObject({
      errors: ["help-missing", "time-length"],
      values: { help: "", time: "t".repeat(101) },
    });
    expect(sampleStore().hubBookings.size).toBe(1);
  });

  it("sends the request, tells the office hours' author, and says so on the request page", async () => {
    await signedInAs(request, "acc-seller");
    expect(
      await redirectOf(() => sendSlotRequest(form({ post: "h-002", help: "Pricing my calculators.", time: "After 13:30" }))),
    ).toBe("/hub/h-002/book");
    expect([...sampleStore().hubBookings.values()].at(-1)).toMatchObject({
      postId: "h-002",
      accountId: "acc-seller",
      help: "Pricing my calculators.",
      time: "After 13:30",
      status: "open",
    });
    expect((await getNotifications("acc-mentor", 1))[0]).toMatchObject({
      kind: "booking",
      text: "Sipho asked for a slot at Office hours: pricing your hustle.",
      href: "/hub/manage#hub-queue",
    });
    expect(await hubNotice()).toBe("slot-requested");
    expect(await readFormState(slotForm("h-002"))).toBeNull();
  });

  it("takes no second open request, and none for office hours that have passed", async () => {
    await signedInAs(request, "acc-student");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-007", help: "Again." })))).toBe("/hub/h-007/book");
    expect(await redirectOf(() => sendSlotRequest(form({ post: "h-012", help: "Too late." })))).toBe("/hub/h-012");
    expect(sampleStore().hubBookings.size).toBe(1);
  });
});
