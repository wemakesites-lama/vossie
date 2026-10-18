import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFormState } from "@/lib/auth/form-state";
import { listAudit } from "@/lib/data/audit";
import { publishedPost } from "@/lib/data/hub-posts";
import { getNotifications } from "@/lib/data/notifications";
import { photoSrcsOf } from "@/lib/data/photos";
import { resetSampleStore, sampleStore } from "@/lib/data/store";
import { pngBytes } from "@/tests/helpers/image-bytes";
import { redirectOf, redirectSignalOf, resetRequest, type FakeRequest } from "@/tests/helpers/next-request";
import { form, signedInAs, STAFF_NOW } from "@/tests/helpers/staff";
import { clearStaffForm, postForm, STAFF_NOTICE } from "./form-state";
import { answerSlot, savePost } from "./hub-actions";
import { issueOnceToken, ONCE_TTL_MS } from "./once";

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

const tip = {
  post: "",
  kind: "tip",
  title: "Price by the hour",
  campus: "all",
  date: "",
  time: "",
  place: "",
  capacity: "",
  summary: "Work out what an hour of your time is worth.",
  body: "## Start with your costs\n- Materials\n- Transport",
  published: "yes",
  intent: "save",
};

// Wednesday 14 October 2026 is 10:42 in South Africa (STAFF_NOW), so these two are on either side of it.
const officeHours = {
  ...tip,
  kind: "office-hours",
  title: "Office hours: photos",
  campus: "midrand",
  date: "2026-10-14",
  time: "11:00",
  place: "The Hub, Block C",
};

/**
 * The editor's form as the browser posts it. A new post comes with the one-time token the page drew when it showed the
 * form (amendment 15.7); an edit carries none. Signed out there is no token to draw.
 */
async function fresh(fields: Readonly<Record<string, string | File>>): Promise<FormData> {
  return form(fields.post ? fields : { ...fields, once: (await issueOnceToken()) ?? "" });
}

const newestPost = () => [...sampleStore().hubPosts.values()].at(-1)!;
const notice = async () => (await readFormState(STAFF_NOTICE))?.notice ?? null;

describe("saving a Hub post (staff tools spec 2.4, plan decision 11)", () => {
  it("sends a signed-out visitor to sign in, and gives a student the 404", async () => {
    expect(await redirectOf(async () => savePost(await fresh(tip)))).toBe("/login?next=%2Fhub%2Fnew");
    expect(await redirectOf(async () => savePost(await fresh({ ...tip, post: "h-002" })))).toBe("/login?next=%2Fhub%2Fh-002%2Fedit");
    await signedInAs(request, "acc-student");
    await expect(savePost(await fresh(tip))).rejects.toThrow("notFound");
    await expect(savePost(await fresh({ ...tip, post: "h-002" }))).rejects.toThrow("notFound");
    expect(sampleStore().hubPosts.size).toBe(18);
    expect(sampleStore().hubPosts.get("h-002")?.title).toBe("Office hours: pricing your hustle");
  });

  it("publishes a new post: on the feed, in the log, the Hub's pages expired, and back to the list", async () => {
    await signedInAs(request, "acc-mentor");
    const redirect = await redirectSignalOf(async () => savePost(await fresh(tip)));
    expect([redirect.url, redirect.type]).toEqual(["/hub/manage", "replace"]);
    const row = newestPost();
    expect(row).toMatchObject({ title: "Price by the hour", authorId: "acc-mentor", published: true, campusSlug: "all" });
    expect(publishedPost(row.id)?.body).toBe("## Start with your costs\n- Materials\n- Transport");
    expect((await listAudit({ staff: null, kind: null }))[0]).toMatchObject({
      staffName: "Naledi",
      action: "post-created",
      targetName: "Price by the hour",
      detail: "Published",
    });
    expect(request.updatedTags).toEqual(["hub"]);
    expect(await notice()).toBe("post-published");
  });

  it("keeps an unticked Published as a draft only staff see", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(async () => savePost(await fresh({ ...tip, published: "" })));
    expect(publishedPost(newestPost().id)).toBeNull();
    expect(await notice()).toBe("post-draft");
    expect((await listAudit({ staff: null, kind: null }))[0].detail).toBe("Draft");
  });

  it("keeps everything typed, the body up to 8,000 characters, and says what's wrong, saving nothing", async () => {
    await signedInAs(request, "acc-mentor");
    const body = "b".repeat(4500);
    expect(await redirectOf(async () => savePost(await fresh({ ...tip, kind: "event", title: "", body })))).toBe("/hub/new");
    expect(await readFormState(postForm(null))).toMatchObject({
      errors: [
        "post-title-missing",
        "post-date-missing",
        "post-time-missing",
        "post-place-missing",
        "post-capacity-invalid",
        "post-body-length",
      ],
      values: { kind: "event", title: "", body, published: "yes" },
      notice: null,
    });
    expect(sampleStore().hubPosts.size).toBe(18);
    expect(request.updatedTags).toEqual([]);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
  });

  it("previews without saving or checking, keeping every field and a cover picked before it (plan decision 12)", async () => {
    await signedInAs(request, "acc-mentor");
    const cover = new File([pngBytes()], "cover.png", { type: "image/png" });
    expect(await redirectOf(async () => savePost(await fresh({ ...tip, title: "", intent: "preview", cover })))).toBe(
      "/hub/new#new-post-preview",
    );
    const state = (await readFormState(postForm(null)))!;
    expect(state).toMatchObject({ notice: "preview", errors: [], values: { title: "", body: tip.body } });
    expect(state.values.cover).toMatch(/^\/photos\/ph-[0-9a-f-]{36}$/);
    expect(sampleStore().hubPosts.size).toBe(18);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
    await redirectOf(async () => savePost(await fresh({ ...tip, keepCover: state.values.cover })));
    const row = newestPost();
    expect(row.image).toEqual({ src: state.values.cover, alt: "" });
    expect(await photoSrcsOf("hub", `post:${row.id}`, STAFF_NOW)).toEqual(new Set([state.values.cover]));
  });

  it("previews an edit on the post's own page, and keeps the preview's words in that post's form", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(async () => savePost(await fresh({ ...tip, post: "h-002", intent: "preview", body: "## Bring" })))).toBe(
      "/hub/h-002/edit#edit-h-002-preview",
    );
    expect(await readFormState(postForm("h-002"))).toMatchObject({ notice: "preview", values: { body: "## Bring" } });
    expect(await readFormState(postForm(null))).toBeNull();
  });

  it("doesn't keep a cover that isn't one of the Hub's waiting photos", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(async () => savePost(await fresh({ ...tip, keepCover: "/placeholders/hub/h-001.svg" })));
    expect(newestPost().image).toEqual({ src: "/placeholders/hub/banner.svg", alt: "" });
    await redirectOf(async () =>
      savePost(await fresh({ ...tip, keepCover: "/photos/ph-00000000-0000-4000-8000-000000000000" })),
    );
    expect(newestPost().image).toEqual({ src: "/placeholders/hub/banner.svg", alt: "" });
  });

  it("says why a cover was refused, and saves nothing", async () => {
    await signedInAs(request, "acc-mentor");
    const notAPhoto = new File(["not a photo"], "cover.png", { type: "image/png" });
    expect(await redirectOf(async () => savePost(await fresh({ ...tip, cover: notAPhoto })))).toBe("/hub/new");
    expect((await readFormState(postForm(null)))?.errors).toEqual(["photo-type"]);
    expect(sampleStore().hubPosts.size).toBe(18);
  });

  it("replaces a post's cover on an edit and deletes the one it had", async () => {
    await signedInAs(request, "acc-mentor");
    const send = (name: string) =>
      redirectOf(async () =>
        savePost(await fresh({ ...tip, post: "h-001", cover: new File([pngBytes()], name, { type: "image/png" }) })),
      );
    // h-001 is the admin's to edit (a sample); the mentor gets the 404, so the admin changes its cover twice.
    await expect(send("a.png")).rejects.toThrow("notFound");
    await signedInAs(request, "acc-admin");
    await send("a.png");
    const first = [...(await photoSrcsOf("hub", "post:h-001", STAFF_NOW))];
    expect(first).toHaveLength(1);
    expect(sampleStore().hubPosts.get("h-001")?.image.src).toBe(first[0]);
    await send("b.png");
    const second = [...(await photoSrcsOf("hub", "post:h-001", STAFF_NOW))];
    expect(second).toHaveLength(1);
    expect(second[0]).not.toBe(first[0]);
    expect(sampleStore().photos.size).toBe(1);
  });

  it("lets a mentor edit their own post and no one else's, and an admin edit any", async () => {
    await signedInAs(request, "acc-mentor");
    const edit = {
      ...tip,
      post: "h-002",
      kind: "office-hours",
      campus: "midrand",
      date: "2026-10-15",
      time: "13:00",
      place: "The Hub, Block C",
    };
    expect(await redirectOf(async () => savePost(await fresh({ ...edit, title: "Office hours: prices" })))).toBe("/hub/manage");
    expect(sampleStore().hubPosts.get("h-002")).toMatchObject({
      title: "Office hours: prices",
      startsAt: "2026-10-15T11:00:00.000Z",
    });
    expect((await listAudit({ staff: null, kind: null }))[0].action).toBe("post-updated");
    await expect(savePost(await fresh({ ...tip, post: "h-001" }))).rejects.toThrow("notFound");
    await signedInAs(request, "acc-admin");
    await redirectOf(async () => savePost(await fresh({ ...tip, post: "h-001" })));
    expect(sampleStore().hubPosts.get("h-001")).toMatchObject({ kind: "tip", authorId: null });
  });

  it("gives the 404 to a post that doesn't exist and to an id that isn't one", async () => {
    await signedInAs(request, "acc-admin");
    await expect(savePost(await fresh({ ...tip, post: "h-nothing" }))).rejects.toThrow("notFound");
    await expect(savePost(await fresh({ ...tip, post: "../h-001" }))).rejects.toThrow("notFound");
    expect(sampleStore().hubPosts.size).toBe(18);
  });
});

describe("a new date must not have passed (staff tools amendment 12.5)", () => {
  it("refuses a new event or office hours that starts before now, beside the date field, saving nothing", async () => {
    await signedInAs(request, "acc-mentor");
    // 10:00 SAST on the 14th is 8:00 UTC, 42 minutes ago.
    expect(await redirectOf(async () => savePost(await fresh({ ...officeHours, time: "10:00" })))).toBe("/hub/new");
    expect((await readFormState(postForm(null)))?.errors).toEqual(["post-date-past"]);
    expect(sampleStore().hubPosts.size).toBe(18);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
    await redirectOf(async () => savePost(await fresh({ ...officeHours, kind: "event", date: "2026-10-13", time: "18:00", capacity: "20" })));
    expect((await readFormState(postForm(null)))?.errors).toEqual(["post-date-past"]);
  });

  it("accepts a start later today, and says the past date among the other problems in the form's order", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(async () => savePost(await fresh(officeHours)))).toBe("/hub/manage");
    expect(newestPost().startsAt).toBe("2026-10-14T09:00:00.000Z");
    await redirectOf(async () => savePost(await fresh({ ...officeHours, title: "", date: "2026-10-01", place: "" })));
    expect((await readFormState(postForm(null)))?.errors).toEqual(["post-title-missing", "post-date-past", "post-place-missing"]);
  });

  it("refuses an edit that moves a post's date to the past, and a dated kind that was a tip", async () => {
    await signedInAs(request, "acc-admin");
    await redirectOf(async () => savePost(await fresh({ ...officeHours, post: "h-002", date: "2026-10-01" })));
    expect((await readFormState(postForm("h-002")))?.errors).toEqual(["post-date-past"]);
    expect(sampleStore().hubPosts.get("h-002")?.startsAt).toBe("2026-10-15T11:00:00Z");
    await redirectOf(async () => savePost(await fresh({ ...officeHours, post: "h-013", time: "10:00" })));
    expect((await readFormState(postForm("h-013")))?.errors).toEqual(["post-date-past"]);
  });

  it("lets a post that has already passed be edited when its date is left as it is", async () => {
    await signedInAs(request, "acc-mentor");
    // h-012 was on 24 September, at 13:00 SAST.
    const past = { ...officeHours, post: "h-012", date: "2026-09-24", time: "13:00", title: "Office hours: registering" };
    expect(await redirectOf(async () => savePost(await fresh(past)))).toBe("/hub/manage");
    expect(sampleStore().hubPosts.get("h-012")?.title).toBe("Office hours: registering");
    // Moving it to another past day is not.
    await redirectOf(async () => savePost(await fresh({ ...past, date: "2026-09-25" })));
    expect((await readFormState(postForm("h-012")))?.errors).toEqual(["post-date-past"]);
  });

  it("doesn't check a Preview, and a tip has no date to check", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(async () => savePost(await fresh({ ...officeHours, date: "2026-10-01", intent: "preview" })));
    expect(await readFormState(postForm(null))).toMatchObject({ notice: "preview", errors: [] });
    await redirectOf(async () => savePost(await fresh({ ...tip, date: "2020-01-01", time: "08:00" })));
    expect(newestPost()).toMatchObject({ kind: "tip", startsAt: null });
  });
});

describe("a new post is made once (staff tools amendment 15.7)", () => {
  const FORGED = "00000000-0000-4000-8000-000000000000";

  it("makes one post however many times the form is sent, and the repeat goes where the first went", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    const send = () => redirectSignalOf(() => savePost(form({ ...tip, once })));
    expect((await send()).url).toBe("/hub/manage");
    const posts = sampleStore().hubPosts.size;
    expect(posts).toBe(19);
    // The list took its notice; the repeat says it again, as the first did, instead of "nothing changed".
    await clearStaffForm(STAFF_NOTICE);
    expect([(await send()).url, await notice()]).toEqual(["/hub/manage", "post-published"]);
    expect(sampleStore().hubPosts.size).toBe(posts);
    expect(await listAudit({ staff: null, kind: null })).toHaveLength(1);
    expect(request.updatedTags).toEqual(["hub"]);
  });

  it("makes one post when two sends arrive together", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    const send = () => redirectOf(() => savePost(form({ ...tip, once })));
    const results = await Promise.allSettled([send(), send()]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(sampleStore().hubPosts.size).toBe(19);
    expect(await listAudit({ staff: null, kind: null })).toHaveLength(1);
  });

  it("refuses a form with no token, a made-up one, a badly shaped one or one that has run out, keeping what was typed", async () => {
    await signedInAs(request, "acc-mentor");
    const old = (await issueOnceToken())!;
    vi.setSystemTime(new Date(STAFF_NOW.getTime() + ONCE_TTL_MS));
    for (const once of ["", FORGED, "x".repeat(100_000), old]) {
      expect(await redirectOf(() => savePost(form({ ...tip, once })))).toBe("/hub/new");
      expect(await readFormState(postForm(null)), once.slice(0, 12)).toMatchObject({
        errors: ["once-expired"],
        values: { title: tip.title, body: tip.body, published: "yes" },
        notice: null,
      });
    }
    expect(sampleStore().hubPosts.size).toBe(18);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
    expect(request.updatedTags).toEqual([]);
  });

  it("refuses another browser's token", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    await signedInAs(request, "acc-admin");
    expect(await redirectOf(() => savePost(form({ ...tip, once })))).toBe("/hub/new");
    expect((await readFormState(postForm(null)))?.errors).toEqual(["once-expired"]);
    expect(sampleStore().hubPosts.size).toBe(18);
  });

  it("keeps the token through a Preview and through a post that fails its checks", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    await redirectOf(() => savePost(form({ ...tip, once, intent: "preview" })));
    await redirectOf(() => savePost(form({ ...tip, once, title: "" })));
    expect((await readFormState(postForm(null)))?.errors).toEqual(["post-title-missing"]);
    expect(sampleStore().hubPosts.size).toBe(18);
    await redirectOf(() => savePost(form({ ...tip, once })));
    expect(sampleStore().hubPosts.size).toBe(19);
  });

  it("goes back to the list before storing another cover when the first save has been made", async () => {
    await signedInAs(request, "acc-mentor");
    const once = (await issueOnceToken())!;
    const cover = () => new File([pngBytes()], "cover.png", { type: "image/png" });
    await redirectOf(() => savePost(form({ ...tip, once, cover: cover() })));
    expect(sampleStore().photos.size).toBe(1);
    await redirectOf(() => savePost(form({ ...tip, once, cover: cover() })));
    expect(sampleStore().photos.size).toBe(1);
    expect(sampleStore().hubPosts.size).toBe(19);
  });

  it("needs no token to edit a post, and ignores one", async () => {
    await signedInAs(request, "acc-admin");
    await redirectOf(() => savePost(form({ ...tip, post: "h-001", once: FORGED })));
    expect(sampleStore().hubPosts.get("h-001")).toMatchObject({ title: "Price by the hour" });
  });
});

describe("an unchanged Save writes nothing (staff tools amendment 15.7, plan decision 23)", () => {
  /** h-002 as the editor would post it back untouched. */
  function untouched() {
    const row = sampleStore().hubPosts.get("h-002")!;
    return {
      post: "h-002",
      kind: row.kind,
      title: row.title,
      campus: row.campusSlug,
      date: "2026-10-15",
      time: "13:00",
      place: row.place ?? "",
      capacity: "",
      summary: row.summary,
      body: row.body,
      published: "yes",
      intent: "save",
    };
  }

  it("leaves the post, the log, the Hub's pages and the updated time alone, and says nothing changed", async () => {
    await signedInAs(request, "acc-mentor");
    const before = structuredClone(sampleStore().hubPosts.get("h-002"));
    expect(await redirectOf(() => savePost(form(untouched())))).toBe("/hub/manage");
    expect(sampleStore().hubPosts.get("h-002")).toEqual(before);
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
    expect(request.updatedTags).toEqual([]);
    expect(await notice()).toBe("nothing");
  });

  it("counts the same moment as the same, however the stored time is written", async () => {
    await signedInAs(request, "acc-mentor");
    // h-002 is stored as "2026-10-15T11:00:00Z", the editor posts 13:00 SAST, which is 11:00:00.000Z.
    expect(sampleStore().hubPosts.get("h-002")?.startsAt).toBe("2026-10-15T11:00:00Z");
    await redirectOf(() => savePost(form(untouched())));
    expect(sampleStore().hubPosts.get("h-002")?.startsAt).toBe("2026-10-15T11:00:00Z");
  });

  it("still saves and logs a change to any one field, the published box or the cover", async () => {
    await signedInAs(request, "acc-mentor");
    const changes: Record<string, string> = {
      title: "Office hours: prices",
      place: "The Hub, Block D",
      time: "14:00",
      summary: "Bring your price list.",
      published: "",
      body: "A new body.",
      campus: "pretoria",
    };
    for (const [name, value] of Object.entries(changes)) {
      const entries = (await listAudit({ staff: null, kind: null })).length;
      await redirectOf(() => savePost(form({ ...untouched(), [name]: value })));
      expect((await listAudit({ staff: null, kind: null })).length, name).toBe(entries + 1);
      await redirectOf(() => savePost(form(untouched())));
    }
    const entries = (await listAudit({ staff: null, kind: null })).length;
    const cover = new File([pngBytes()], "cover.png", { type: "image/png" });
    await redirectOf(() => savePost(form({ ...untouched(), cover })));
    expect((await listAudit({ staff: null, kind: null })).length).toBe(entries + 1);
    expect(sampleStore().hubPosts.get("h-002")?.image.src).toMatch(/^\/photos\/ph-/);
  });

  it("logs a post turned into a draft once, and a second save of that draft changes nothing", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(() => savePost(form({ ...untouched(), published: "" })));
    expect(await notice()).toBe("post-draft");
    await redirectOf(() => savePost(form({ ...untouched(), published: "" })));
    expect(await notice()).toBe("nothing");
    expect((await listAudit({ staff: null, kind: null })).map((entry) => entry.action)).toEqual(["post-updated"]);
  });
});

describe("the office-hours queue (staff tools spec 2.4, plan decision 14)", () => {
  it("sends a signed-out visitor to sign in, and gives a student the 404, leaving the request open", async () => {
    expect(await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "accepted" })))).toBe(
      "/login?next=%2Fhub%2Fmanage",
    );
    await signedInAs(request, "acc-student");
    await expect(answerSlot(form({ booking: "bk-s1", answer: "accepted" }))).rejects.toThrow("notFound");
    expect(sampleStore().hubBookings.get("bk-s1")?.status).toBe("open");
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
  });

  it("accepts a request once: the student told, the answer in the log", async () => {
    await signedInAs(request, "acc-mentor");
    expect(await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "accepted" })))).toBe(
      "/hub/manage#hub-queue",
    );
    expect(sampleStore().hubBookings.get("bk-s1")).toMatchObject({ status: "accepted", answeredBy: "acc-mentor" });
    expect((await getNotifications("acc-student", 1))[0]).toMatchObject({
      kind: "booking",
      text: "A mentor accepted your slot request for Office hours: your first listing.",
      href: "/hub/h-007/book",
    });
    expect((await listAudit({ staff: null, kind: "office-hours" }))[0]).toMatchObject({
      action: "booking-accepted",
      targetName: "Thandi: Office hours: your first listing",
    });
    expect(await notice()).toBe("booking-accepted");
    const entries = (await listAudit({ staff: null, kind: null })).length;
    const told = (await getNotifications("acc-student", 50)).length;
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "declined" })));
    expect(sampleStore().hubBookings.get("bk-s1")?.status).toBe("accepted");
    expect(await notice()).toBe("nothing");
    expect((await listAudit({ staff: null, kind: null })).length).toBe(entries);
    expect(await getNotifications("acc-student", 50)).toHaveLength(told);
  });

  it("declines, and refuses an answer it doesn't know", async () => {
    await signedInAs(request, "acc-admin");
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "maybe" })));
    expect(sampleStore().hubBookings.get("bk-s1")?.status).toBe("open");
    await redirectOf(() => answerSlot(form({ booking: "bk-s1", answer: "declined" })));
    expect((await getNotifications("acc-student", 1))[0].text).toBe(
      "A mentor couldn't fit in your slot request for Office hours: your first listing. You can ask again.",
    );
    expect(await notice()).toBe("booking-declined");
  });

  it("does nothing for a request that isn't there", async () => {
    await signedInAs(request, "acc-mentor");
    await redirectOf(() => answerSlot(form({ booking: "bk-nothing", answer: "accepted" })));
    expect(await notice()).toBe("nothing");
    expect(await listAudit({ staff: null, kind: null })).toEqual([]);
  });
});
