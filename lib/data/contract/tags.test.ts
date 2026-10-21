import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { samplePickupPointRows } from "@/data/fixtures/staff";
import { listPins } from "@/lib/data/featured";
import { saveHubPost } from "@/lib/data/hub-posts";
import { listSavedSearches } from "@/lib/data/saved-searches";
import { listOwnRequests, setRequestOpen } from "@/lib/data/requests";
import { setVerified } from "@/lib/data/staff-shops";
import * as following from "@/lib/following/actions";
import { followNoteKey } from "@/lib/following/rules";
import * as hub from "@/lib/hub-actions";
import * as lookingFor from "@/lib/looking-for/actions";
import { requestNoteKey, YOUR_REQUESTS_FORM } from "@/lib/looking-for/paths";
import { addDays } from "@/lib/looking-for/rules";
import * as savedSearches from "@/lib/saved-searches/actions";
import { SAVED_SEARCHES_FORM } from "@/lib/saved-searches/rules";
import * as accounts from "@/lib/staff/account-actions";
import * as admin from "@/lib/staff/admin-actions";
import { HUB_NOTICE, STAFF_NOTICE } from "@/lib/staff/form-state";
import * as hubStaff from "@/lib/staff/hub-actions";
import * as mentor from "@/lib/staff/mentor-actions";
import { issueOnceToken } from "@/lib/staff/once";
import type { PostFields } from "@/lib/staff/post-rules";
import { sastDate } from "@/lib/time";
import { actionContract, type ActionScenario, signInSample } from "@/tests/contract/actions";
import { recording, replaying } from "@/tests/contract/replay";
import { sampleWorld } from "@/tests/contract/sample-world";
import type { FakeRequest } from "@/tests/helpers/next-request";

// Every write action's cache tags on both backends (C4/C5 plan Task 22; decision 17): the table below, run on the
// sample store, then the same post again on Supabase with lib/data and the session answered by what the sample store
// answered (tests/contract/replay.ts). The actions' own backend-dependent code (sampleFollowUps, tokenTakenInSql, the
// SQL refusals) is all that differs, so both must expire the same tags. Each row's setting changes something, which its
// notice (or a read) confirms on the sample store.

const request = vi.hoisted((): FakeRequest => ({ cookies: new Map(), sent: new Map(), proto: "http" }));
vi.mock("next/headers", async () => (await import("@/tests/helpers/next-request")).nextHeaders(request));
vi.mock("next/navigation", async () => (await import("@/tests/helpers/next-request")).nextNavigation());
vi.mock("next/server", async () => (await import("@/tests/helpers/next-request")).nextServer());
vi.mock("next/cache", async () => (await import("@/tests/helpers/next-request")).nextCache(request));
// lib/data's modules the actions reach, and the session, recorded on the sample store and replayed on Supabase.
vi.mock("@/lib/auth/session", async (original) => (await import("@/tests/contract/replay")).wrapModule("session", await original<object>()));
vi.mock("@/lib/data", async (original) => (await import("@/tests/contract/replay")).wrapModule("data", await original<object>()));
vi.mock("@/lib/data/audit", async (original) => (await import("@/tests/contract/replay")).wrapModule("audit", await original<object>()));
vi.mock("@/lib/data/featured", async (original) => (await import("@/tests/contract/replay")).wrapModule("featured", await original<object>()));
vi.mock("@/lib/data/follows", async (original) => (await import("@/tests/contract/replay")).wrapModule("follows", await original<object>()));
vi.mock("@/lib/data/form-states", async (original) => (await import("@/tests/contract/replay")).wrapModule("form-states", await original<object>()));
vi.mock("@/lib/data/hub-posts", async (original) => (await import("@/tests/contract/replay")).wrapModule("hub-posts", await original<object>()));
vi.mock("@/lib/data/mentors", async (original) => (await import("@/tests/contract/replay")).wrapModule("mentors", await original<object>()));
vi.mock("@/lib/data/messages", async (original) => (await import("@/tests/contract/replay")).wrapModule("messages", await original<object>()));
vi.mock("@/lib/data/notifications", async (original) => (await import("@/tests/contract/replay")).wrapModule("notifications", await original<object>()));
vi.mock("@/lib/data/offers", async (original) => (await import("@/tests/contract/replay")).wrapModule("offers", await original<object>()));
vi.mock("@/lib/data/photos", async (original) => (await import("@/tests/contract/replay")).wrapModule("photos", await original<object>()));
vi.mock("@/lib/data/pickup-points", async (original) => (await import("@/tests/contract/replay")).wrapModule("pickup-points", await original<object>()));
vi.mock("@/lib/data/requests", async (original) => (await import("@/tests/contract/replay")).wrapModule("requests", await original<object>()));
vi.mock("@/lib/data/saved-searches", async (original) => (await import("@/tests/contract/replay")).wrapModule("saved-searches", await original<object>()));
vi.mock("@/lib/data/staff-accounts", async (original) => (await import("@/tests/contract/replay")).wrapModule("staff-accounts", await original<object>()));
vi.mock("@/lib/data/staff-reports", async (original) => (await import("@/tests/contract/replay")).wrapModule("staff-reports", await original<object>()));
vi.mock("@/lib/data/staff-shops", async (original) => (await import("@/tests/contract/replay")).wrapModule("staff-shops", await original<object>()));

type Action = (formData: FormData) => Promise<void>;
type Fields = Record<string, string>;

/** One row of the table: what the action expires when it changes something, and a setting where it does. */
type Row = {
  action: Action;
  /** The row's name, where one action has two (an edit, a settle). */
  name?: string;
  tags: readonly string[];
  /** Puts the sample store where the post changes something, signs the actor in, and gives the fields. */
  setUp: (scenario: ActionScenario) => Promise<Fields>;
  /** Proves on the sample store that it did. */
  changed: (scenario: ActionScenario, fields: Fields) => Promise<void>;
};

const REASON = "A reason the Hub gives, long enough to keep.";
const ahead = (days = 7) => addDays(sastDate(new Date()), days);
const noticeIs = (code: string, key = STAFF_NOTICE) => async (scenario: ActionScenario) => {
  expect((await scenario.notice(key))?.notice).toBe(code);
};

const REQUEST_FORM = {
  title: "A contract desk lamp",
  category: "tech",
  campus: "pretoria",
  details: "A lamp that clips onto a desk, for the contract tests.",
  budget: "R150",
  neededBy: "",
};
const TIP = {
  post: "",
  kind: "tip",
  title: "Contract tip on tags",
  campus: "all",
  date: "",
  time: "",
  place: "",
  capacity: "",
  summary: "A tip the tag table posts.",
  body: "A tip the tag table posts.",
  published: "yes",
  intent: "save",
};

/** A published post a week ahead, written by "staff" through the data layer; its id. */
async function hubPost(scenario: ActionScenario, fields: Partial<PostFields>): Promise<string> {
  const post: PostFields = {
    kind: "event",
    title: "Contract tag event",
    campusSlug: "pretoria",
    startsAt: `${ahead()}T08:00:00.000Z`,
    place: "The Hub",
    capacity: 20,
    summary: "A post the tag table makes.",
    body: "A post the tag table makes.",
    published: true,
    ...fields,
  };
  const saved = await saveHubPost({ id: null, fields: post, cover: null, authorId: await scenario.world.signedIn("staff"), now: new Date() });
  return saved!.row.id;
}

/** "shopper"'s shop with a listing, and its id. */
async function shopWithListing(scenario: ActionScenario) {
  const slug = await scenario.world.openShop("shopper");
  const listing = await scenario.world.addListing(slug, { title: "Contract tag lamp" });
  return { slug, listing };
}

const ROWS: readonly Row[] = [
  // --- The admin's actions ----------------------------------------------------------------------------------------
  {
    action: admin.approveSeller,
    tags: ["sellers"],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper", { status: "pending" });
      await s.signIn("staff");
      return { shop, owner: await s.world.signedIn("shopper") };
    },
    changed: noticeIs("approved"),
  },
  {
    action: admin.declineSeller,
    tags: [],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper", { status: "pending" });
      await s.signIn("staff");
      return { shop, owner: await s.world.signedIn("shopper"), reason: REASON };
    },
    changed: noticeIs("declined"),
  },
  {
    action: admin.verifySeller,
    tags: ["sellers"],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.signIn("staff");
      return { shop, verified: "yes" };
    },
    changed: noticeIs("verified"),
  },
  {
    action: admin.verifySeller,
    name: "unverify",
    tags: ["sellers"],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await setVerified(shop, true);
      await s.signIn("staff");
      return { shop, verified: "no" };
    },
    changed: noticeIs("unverified"),
  },
  {
    action: admin.pauseSeller,
    tags: ["sellers"],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.signIn("staff");
      return { shop, reason: REASON };
    },
    changed: noticeIs("paused"),
  },
  {
    action: admin.resumeSeller,
    tags: ["sellers"],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.world.pauseShop(shop, "staff");
      await s.signIn("staff");
      return { shop };
    },
    changed: noticeIs("resumed"),
  },
  {
    action: admin.assignMentor,
    tags: [],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.world.setRoles("asker", ["mentor"]);
      await s.signIn("staff");
      return { shop, mentor: await s.world.signedIn("asker") };
    },
    changed: noticeIs("mentor-assigned"),
  },
  {
    action: admin.dismissReport,
    tags: [],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      const report = await s.world.addReport("asker", { kind: "seller", id: shop });
      await s.signIn("staff");
      return { report, note: "No problem found." };
    },
    changed: noticeIs("dismissed"),
  },
  {
    action: admin.hideReportedListing,
    tags: ["listings"],
    setUp: async (s) => {
      const { listing } = await shopWithListing(s);
      const report = await s.world.addReport("asker", { kind: "listing", id: listing });
      await s.signIn("staff");
      return { report, reason: REASON };
    },
    changed: noticeIs("hidden"),
  },
  {
    action: admin.hideReportedRequest,
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      const report = await s.world.addReport("seller", { kind: "request", id: request });
      await s.signIn("staff");
      return { report, reason: REASON };
    },
    changed: noticeIs("request-hidden"),
  },
  {
    action: admin.pauseReportedShop,
    tags: ["sellers"],
    setUp: async (s) => {
      const { listing } = await shopWithListing(s);
      const report = await s.world.addReport("asker", { kind: "listing", id: listing });
      await s.signIn("staff");
      return { report, reason: REASON };
    },
    changed: noticeIs("report-paused"),
  },
  {
    action: admin.pinSeller,
    tags: [],
    setUp: async (s) => {
      const { slug } = await shopWithListing(s);
      await setVerified(slug, true);
      await s.signIn("staff");
      return { seller: slug, campus: "all", day: ahead(5) };
    },
    changed: noticeIs("pinned"),
  },
  {
    action: admin.unpinSeller,
    tags: [],
    setUp: async (s) => {
      const { slug } = await shopWithListing(s);
      await s.world.addPin("all", ahead(5), slug);
      await s.signIn("staff");
      return { pin: (await listPins(ahead(5), null)).find((pin) => pin.sellerSlug === slug)!.id };
    },
    changed: noticeIs("unpinned"),
  },
  {
    action: admin.addPoint,
    tags: ["pickup-points"],
    setUp: async (s) => {
      await s.signIn("staff");
      return { campus: "pretoria", name: "Contract tag gate" };
    },
    changed: noticeIs("point-added"),
  },
  {
    action: admin.renamePoint,
    tags: ["pickup-points"],
    setUp: async (s) => {
      await s.signIn("staff");
      return { point: samplePickupPointRows[0].id, name: "Contract renamed gate" };
    },
    changed: noticeIs("point-renamed"),
  },
  {
    action: admin.retirePoint,
    tags: ["pickup-points"],
    setUp: async (s) => {
      await s.signIn("staff");
      return { point: samplePickupPointRows[0].id };
    },
    changed: noticeIs("point-retired"),
  },
  {
    action: admin.restorePoint,
    tags: ["pickup-points"],
    setUp: async (s) => {
      await s.world.retirePickupPoint(samplePickupPointRows[0].id);
      await s.signIn("staff");
      return { point: samplePickupPointRows[0].id };
    },
    changed: noticeIs("point-restored"),
  },
  {
    action: admin.showListingAgain,
    tags: ["listings"],
    setUp: async (s) => {
      const { listing } = await shopWithListing(s);
      await s.world.hideListing(listing, REASON);
      await s.signIn("staff");
      return { listing };
    },
    changed: noticeIs("listing-shown"),
  },
  {
    action: admin.showRequestAgain,
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await s.world.hideRequest(request, REASON);
      await s.signIn("staff");
      return { request };
    },
    changed: noticeIs("request-shown"),
  },
  // --- Staff roles -----------------------------------------------------------------------------------------------
  {
    action: accounts.giveStaffRole,
    tags: [],
    setUp: async (s) => {
      await s.world.signedIn("shopper");
      await s.signIn("staff");
      return { email: "contract-shopper@vossie.test", role: "mentor", once: (await issueOnceToken())! };
    },
    changed: noticeIs("role-given"),
  },
  {
    action: accounts.removeStaffRole,
    tags: [],
    setUp: async (s) => {
      await s.world.setRoles("shopper", ["mentor"]);
      await s.signIn("staff");
      return { account: await s.world.signedIn("shopper"), role: "mentor" };
    },
    changed: noticeIs("role-removed"),
  },
  // --- The Hub's tools, mentors -----------------------------------------------------------------------------------
  {
    action: hubStaff.savePost,
    tags: ["hub"],
    setUp: async (s) => {
      await s.signIn("staff");
      return { ...TIP, once: (await issueOnceToken())! };
    },
    changed: noticeIs("post-published"),
  },
  {
    action: hubStaff.answerSlot,
    tags: [],
    setUp: async (s) => {
      await s.signIn("staff");
      return { booking: "bk-s1", answer: "accepted" };
    },
    changed: noticeIs("booking-accepted"),
  },
  {
    action: mentor.addMentorNote,
    tags: [],
    setUp: async (s) => {
      await s.world.setRoles("asker", ["mentor"]);
      const shop = await s.world.openShop("shopper");
      await s.world.setMentor(shop, "asker");
      await s.signIn("asker");
      return { shop, text: "Replies fast. Next: better photos.", once: (await issueOnceToken())! };
    },
    changed: noticeIs("note-added"),
  },
  {
    action: mentor.addCheckIn,
    tags: [],
    setUp: async (s) => {
      await s.world.setRoles("asker", ["mentor"]);
      const shop = await s.world.openShop("shopper");
      await s.world.setMentor(shop, "asker");
      await s.signIn("asker");
      return { shop, day: sastDate(new Date()), text: "Met at the Hub today.", once: (await issueOnceToken())! };
    },
    changed: noticeIs("check-in-added"),
  },
  // --- A student's RSVP and slot request --------------------------------------------------------------------------
  {
    action: hub.rsvpToEvent,
    tags: ["hub"],
    setUp: async (s) => {
      const post = await hubPost(s, {});
      await s.signIn("asker");
      return { post };
    },
    changed: noticeIs("rsvp", HUB_NOTICE),
  },
  {
    action: hub.cancelRsvp,
    tags: ["hub"],
    setUp: async (s) => {
      const post = await hubPost(s, {});
      await s.world.addRsvp(post, "asker");
      await s.signIn("asker");
      return { post };
    },
    changed: noticeIs("rsvp-cancelled", HUB_NOTICE),
  },
  {
    action: hub.sendSlotRequest,
    tags: [],
    setUp: async (s) => {
      const post = await hubPost(s, { kind: "office-hours", capacity: null });
      await s.signIn("asker");
      return { post, help: "How to price a braid.", time: "After 13:00" };
    },
    changed: noticeIs("slot-requested", HUB_NOTICE),
  },
  // --- Looking For ------------------------------------------------------------------------------------------------
  {
    action: lookingFor.saveMyRequest,
    tags: ["requests"],
    setUp: async (s) => {
      await s.signIn("asker");
      return { ...REQUEST_FORM, once: (await issueOnceToken())! };
    },
    changed: async (s) => {
      expect(await listOwnRequests(await s.world.signedIn("asker"), new Date())).toHaveLength(1);
    },
  },
  {
    action: lookingFor.saveMyRequest,
    name: "edit",
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await s.signIn("asker");
      return { ...REQUEST_FORM, request };
    },
    changed: async (s, fields) => noticeIs("saved", requestNoteKey(fields.request))(s),
  },
  {
    action: lookingFor.closeMyRequest,
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await s.signIn("asker");
      return { request };
    },
    changed: async (s, fields) => noticeIs("closed", requestNoteKey(fields.request))(s),
  },
  {
    action: lookingFor.closeMyRequest,
    name: "a settle that closed something",
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract late request", neededBy: ahead(-5) });
      await s.signIn("asker");
      return { request };
    },
    changed: async (s, fields) => expect(await s.notice(requestNoteKey(fields.request))).toBeNull(),
  },
  {
    action: lookingFor.reopenMyRequest,
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await setRequestOpen(await s.world.signedIn("asker"), request, false, new Date());
      await s.signIn("asker");
      return { request };
    },
    changed: async (s, fields) => noticeIs("reopened", requestNoteKey(fields.request))(s),
  },
  {
    action: lookingFor.deleteMyRequest,
    tags: ["requests"],
    setUp: async (s) => {
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await s.signIn("asker");
      return { request };
    },
    changed: noticeIs("deleted", YOUR_REQUESTS_FORM),
  },
  {
    action: lookingFor.sendOffer,
    tags: ["requests"],
    setUp: async (s) => {
      await shopWithListing(s);
      const request = await s.world.addRequest({ asker: "asker", title: "A contract tag request", neededBy: null });
      await s.signIn("shopper");
      return { request, body: "I have one for R120, collected at the Hub." };
    },
    changed: async (s) => {
      expect((await s.world.notificationsOf("asker")).map((note) => note.kind)).toContain("offer");
    },
  },
  // --- Follows and saved searches ---------------------------------------------------------------------------------
  {
    action: following.followShop,
    tags: [],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.signIn("asker");
      return { shop };
    },
    changed: async (s, fields) => noticeIs("followed", followNoteKey(fields.shop))(s),
  },
  {
    action: following.unfollowShop,
    tags: [],
    setUp: async (s) => {
      const shop = await s.world.openShop("shopper");
      await s.world.follow("asker", shop);
      await s.signIn("asker");
      return { shop };
    },
    changed: async (s, fields) => noticeIs("unfollowed", followNoteKey(fields.shop))(s),
  },
  {
    action: savedSearches.saveThisSearch,
    tags: [],
    setUp: async (s) => {
      await s.signIn("asker");
      return { q: "kettle", once: (await issueOnceToken())! };
    },
    changed: async (s) => {
      expect(await listSavedSearches(await s.world.signedIn("asker"))).toHaveLength(1);
    },
  },
  {
    action: savedSearches.pauseSearchAlerts,
    tags: [],
    setUp: async (s) => {
      const search = await s.world.saveSearch("asker", { q: "kettle" });
      await s.signIn("asker");
      return { search };
    },
    changed: noticeIs("paused", SAVED_SEARCHES_FORM),
  },
  {
    action: savedSearches.resumeSearchAlerts,
    tags: [],
    setUp: async (s) => {
      const search = await s.world.saveSearch("asker", { q: "kettle" }, { paused: true });
      await s.signIn("asker");
      return { search };
    },
    changed: noticeIs("resumed", SAVED_SEARCHES_FORM),
  },
  {
    action: savedSearches.deleteSearch,
    tags: [],
    setUp: async (s) => {
      const search = await s.world.saveSearch("asker", { q: "kettle" });
      await s.signIn("asker");
      return { search };
    },
    changed: noticeIs("deleted", SAVED_SEARCHES_FORM),
  },
];

const ACTION_FILES: Record<string, object> = {
  "lib/staff/admin-actions.ts": admin,
  "lib/staff/account-actions.ts": accounts,
  "lib/staff/hub-actions.ts": hubStaff,
  "lib/staff/mentor-actions.ts": mentor,
  "lib/hub-actions.ts": hub,
  "lib/looking-for/actions.ts": lookingFor,
  "lib/following/actions.ts": following,
  "lib/saved-searches/actions.ts": savedSearches,
};

describe("every write action's tags (C4/C5 plan Task 22)", () => {
  it("has a row for every action the files export, and the staff files are all here", () => {
    const staffFiles = ["account", "admin", "hub", "mentor"].map((name) => `lib/staff/${name}-actions.ts`);
    for (const file of staffFiles) expect(Object.keys(ACTION_FILES)).toContain(file);
    expect(readFileSync("lib/staff/hub-actions.ts", "utf8")).toContain('"use server"');
    const covered = new Set(ROWS.map((row) => row.action));
    const missing = Object.entries(ACTION_FILES).flatMap(([file, module]) =>
      Object.entries(module)
        .filter(([, value]) => typeof value === "function" && !covered.has(value as Action))
        .map(([name]) => `${file}: ${name}`),
    );
    expect(missing).toEqual([]);
  });

  actionContract(sampleWorld, request, { signIn: signInSample(request) }, (scenario) => {
    for (const row of ROWS) {
      const name = `${row.action.name}${row.name ? ` (${row.name})` : ""}`;
      it(`${name} expires ${row.tags.length > 0 ? row.tags.join(", ") : "nothing"} on both backends`, async () => {
        const fields = await row.setUp(scenario());
        const before = scenario().tags().length;
        const sample = await recording(() => scenario().post(row.action, fields));
        const sampleTags = scenario().tags().slice(before);
        await row.changed(scenario(), fields);
        const between = scenario().tags().length;
        vi.stubEnv("VOSSIE_BACKEND", "supabase");
        let supabase;
        try {
          supabase = await replaying(() => scenario().post(row.action, fields));
        } finally {
          vi.unstubAllEnvs();
        }
        expect(sample).toMatchObject({ notFound: false, redirect: expect.any(String) });
        expect(supabase).toEqual(sample);
        expect(sampleTags, "sample").toEqual(row.tags);
        expect(scenario().tags().slice(between), "supabase").toEqual(row.tags);
      });
    }
  });
});
