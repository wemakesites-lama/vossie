import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { listPins } from "@/lib/data/featured";
import { listPickupPoints } from "@/lib/data/pickup-points";
import { getOwnRequest } from "@/lib/data/requests";
import { getHidden, getReport } from "@/lib/data/staff-reports";
import { getShopForReview } from "@/lib/data/staff-shops";
import { addDays } from "@/lib/looking-for/rules";
import { requestAutoClosedText, requestHiddenText } from "@/lib/looking-for/words";
import { signInHref } from "@/lib/next-path";
import { sastDate } from "@/lib/time";
import type { ActionScenario } from "@/tests/contract/actions";
import type { WorldAccountName } from "@/tests/contract/world";
import * as adminActions from "../admin-actions";
import {
  addPoint,
  approveSeller,
  assignMentor,
  declineSeller,
  dismissReport,
  hideReportedListing,
  hideReportedRequest,
  pauseReportedShop,
  pauseSeller,
  pinSeller,
  renamePoint,
  restorePoint,
  resumeSeller,
  retirePoint,
  showListingAgain,
  showRequestAgain,
  unpinSeller,
  verifySeller,
} from "../admin-actions";
import { PIN_FORM, STAFF_NOTICE } from "../form-state";
import { listingShownText, requestShownText } from "../notification-text";
import {
  ADMIN_FEATURED_PATH,
  ADMIN_HIDDEN_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_REPORTS_PATH,
  adminReportPath,
  adminSellerPath,
  declineSellerPath,
  hideReportedPath,
  pauseReportedPath,
  pauseSellerPath,
  showListingPath,
  showRequestPath,
} from "../paths";

// Every admin action's gates on both backends (C4/C5 plan Task 16; decisions 2 to 5, 13 and 19): the real Server
// Actions, through the action harness, as the world's accounts. "staff" is an admin who also sells; "asker" becomes a
// second admin where a scenario needs one; "seller" reports. On the sample store the gates are the action's; on
// Supabase the action's own checks come first and the staff functions' gates back them (Task 14 proves those at the data
// level). Every refusal leaves the target, the audit log, everyone's notifications and the cache as they were.
// admin-gates.test.ts runs it on the sample store, admin-gates.db.test.ts on the local stack.

const PEOPLE: readonly WorldAccountName[] = ["staff", "shopper", "asker", "seller"];
const REASON = "A reason the Hub gives, long enough to keep.";

type Action = (formData: FormData) => Promise<void>;

export function adminGatesContract(scenario: () => ActionScenario): void {
  const world = () => scenario().world;
  const setUp = async () => {
    await world().tidyPickupPoints();
    await world().tidyCommunity();
    await world().tidyMessaging();
  };
  const asStaff = <T>(read: (id: string) => Promise<T>) => world().asViewer("staff", read);

  /** What a refusal must leave as it was: the target, the log's size, everyone's notifications, and the cache. */
  const state = async (target: () => Promise<unknown>) => ({
    target: await target(),
    audit: await world().auditCount(),
    notes: await Promise.all(PEOPLE.map((name) => world().notificationsOf(name))),
    tags: [...scenario().tags()],
  });

  /** Posts as the signed-in account, and checks it was refused with `notice` at `path`, changing nothing. */
  const refused = async (
    action: Action,
    fields: Record<string, string>,
    expected: { path: string; notice: "own-shop" | "own-request" },
    target: () => Promise<unknown>,
  ) => {
    const before = await state(target);
    const posted = await scenario().post(action, fields);
    expect(posted, action.name).toMatchObject({ redirect: expected.path, notFound: false });
    expect((await scenario().notice(STAFF_NOTICE))?.notice, action.name).toBe(expected.notice);
    expect(await state(target), action.name).toEqual(before);
  };

  // --- 1. The role first -----------------------------------------------------------------------------------------

  /** Every action with fields that would do something, and the page a signed-out visitor comes back to. */
  const everyAction = (id: string): [Action, Record<string, string>, string][] => [
    [approveSeller, { shop: "tech-corner", owner: id }, adminSellerPath("tech-corner")],
    [declineSeller, { shop: "tech-corner", owner: id, reason: REASON }, declineSellerPath("tech-corner")],
    [verifySeller, { shop: "tech-corner", verified: "yes" }, adminSellerPath("tech-corner")],
    [pauseSeller, { shop: "tech-corner", reason: REASON }, pauseSellerPath("tech-corner")],
    [resumeSeller, { shop: "tech-corner" }, adminSellerPath("tech-corner")],
    [assignMentor, { shop: "tech-corner", mentor: "" }, adminSellerPath("tech-corner")],
    [dismissReport, { report: id, note: REASON }, adminReportPath(id)],
    [hideReportedListing, { report: id, reason: REASON }, hideReportedPath(id)],
    [hideReportedRequest, { report: id, reason: REASON }, hideReportedPath(id)],
    [pauseReportedShop, { report: id, reason: REASON }, pauseReportedPath(id)],
    [pinSeller, { seller: "tech-corner", campus: "all", day: sastDate(new Date()) }, ADMIN_FEATURED_PATH],
    [unpinSeller, { pin: id }, ADMIN_FEATURED_PATH],
    [addPoint, { campus: "pretoria", name: "Contract forged gate" }, ADMIN_POINTS_PATH],
    [renamePoint, { point: id, name: "Contract forged gate" }, ADMIN_POINTS_PATH],
    [retirePoint, { point: id }, ADMIN_POINTS_PATH],
    [restorePoint, { point: id }, ADMIN_POINTS_PATH],
    [showListingAgain, { listing: id }, showListingPath(id)],
    [showRequestAgain, { request: id }, showRequestPath(id)],
  ];

  it("covers every admin action", () => {
    const covered = everyAction(randomUUID()).map(([action]) => action);
    const exported = Object.values(adminActions).filter((value) => typeof value === "function");
    expect(exported.filter((action) => !covered.includes(action as Action)).map((action) => action.name)).toEqual([]);
  });

  it("gives someone without the admin role the 404 for every action, before anything changes", async () => {
    await setUp();
    await scenario().signIn("asker");
    const id = randomUUID();
    const before = await state(async () => null);
    for (const [action, fields] of everyAction(id)) {
      expect(await scenario().post(action, fields), action.name).toEqual({ redirect: null, type: undefined, notFound: true });
    }
    expect(await state(async () => null)).toEqual(before);
  });

  it("sends a signed-out visitor to sign in, coming back to the page", async () => {
    await setUp();
    await scenario().signIn(null);
    const id = randomUUID();
    for (const [action, fields, page] of everyAction(id)) {
      expect((await scenario().post(action, fields)).redirect, action.name).toBe(signInHref(page));
    }
  });

  // --- 2. The admin's own shop, listing and request ---------------------------------------------------------------

  it("refuses Approve and Decline of the admin's own waiting shop, the decline before its reason", async () => {
    await setUp();
    const staffId = (await scenario().signIn("staff"))!;
    const slug = await world().openShop("staff", { status: "pending" });
    const review = () => asStaff(() => getShopForReview(slug));
    const own = { path: adminSellerPath(slug), notice: "own-shop" as const };
    await refused(approveSeller, { shop: slug, owner: staffId }, own, review);
    await refused(declineSeller, { shop: slug, owner: staffId, reason: "" }, own, review);
  });

  /** Staff's open shop with a listing, staff's own request, and a report by "seller" on each. */
  const ownThings = async () => {
    const staffId = (await scenario().signIn("staff"))!;
    const slug = await world().openShop("staff");
    const listing = await world().addListing(slug, { title: "Contract staff's gated lamp" });
    const request = await world().addRequest({ asker: "staff", title: "A contract staff gated request", neededBy: null });
    const reports = {
      shop: await world().addReport("seller", { kind: "seller", id: slug }),
      listing: await world().addReport("seller", { kind: "listing", id: listing }),
      request: await world().addReport("seller", { kind: "request", id: request }),
    };
    return { staffId, slug, listing, request, reports };
  };

  it("refuses Verify, Pause, Resume and a mentor on the admin's own shop", async () => {
    await setUp();
    const { slug } = await ownThings();
    const review = () => asStaff(() => getShopForReview(slug));
    const own = { path: adminSellerPath(slug), notice: "own-shop" as const };
    await refused(verifySeller, { shop: slug, verified: "yes" }, own, review);
    await refused(pauseSeller, { shop: slug, reason: REASON }, own, review);
    await refused(assignMentor, { shop: slug, mentor: "" }, own, review);
    // A second admin pauses it; its owner still can't resume it.
    await world().setRoles("asker", ["admin"]);
    await scenario().signIn("asker");
    expect((await scenario().post(pauseSeller, { shop: slug, reason: REASON })).redirect).toBe(adminSellerPath(slug));
    await scenario().signIn("staff");
    await refused(resumeSeller, { shop: slug }, own, review);
  });

  it("refuses Dismiss, Hide and Pause on reports about the admin's own, a deleted listing's too", async () => {
    await setUp();
    const { listing, reports } = await ownThings();
    const report = (id: string) => () => asStaff((staffId) => getReport(id, staffId));
    const at = (id: string, notice: "own-shop" | "own-request") => ({ path: adminReportPath(id), notice });
    await refused(dismissReport, { report: reports.shop, note: REASON }, at(reports.shop, "own-shop"), report(reports.shop));
    await refused(dismissReport, { report: reports.listing, note: REASON }, at(reports.listing, "own-shop"), report(reports.listing));
    await refused(dismissReport, { report: reports.request, note: REASON }, at(reports.request, "own-request"), report(reports.request));
    await refused(hideReportedListing, { report: reports.listing, reason: REASON }, at(reports.listing, "own-shop"), report(reports.listing));
    await refused(pauseReportedShop, { report: reports.listing, reason: REASON }, at(reports.listing, "own-shop"), report(reports.listing));
    await refused(hideReportedRequest, { report: reports.request, reason: REASON }, at(reports.request, "own-request"), report(reports.request));
    await world().deleteListing(listing);
    await refused(dismissReport, { report: reports.listing, note: REASON }, at(reports.listing, "own-shop"), report(reports.listing));
  });

  it("refuses Pin and Remove pin on the admin's own shop", async () => {
    await setUp();
    const { slug, staffId } = await ownThings();
    const day = addDays(sastDate(new Date()), 5);
    await world().forgetFeaturedDays([day]);
    await world().addPin("all", day, slug);
    const pins = () => asStaff(() => listPins(day, staffId));
    const pin = (await pins()).find((item) => item.sellerSlug === slug)!;
    expect(pin.own).toBe(true);
    const own = { path: ADMIN_FEATURED_PATH, notice: "own-shop" as const };
    await refused(pinSeller, { seller: slug, campus: "pretoria", day }, own, pins);
    await refused(unpinSeller, { pin: pin.id }, own, pins);
  });

  it("refuses Show again of the admin's own listing and request, hidden by another admin", async () => {
    await setUp();
    const { listing, request } = await ownThings();
    await world().hideListing(listing, REASON);
    await world().hideRequest(request, REASON);
    const hidden = (kind: "listing" | "request", id: string) => () => asStaff((staffId) => getHidden(kind, id, staffId));
    await refused(showListingAgain, { listing }, { path: ADMIN_HIDDEN_PATH, notice: "own-shop" }, hidden("listing", listing));
    await refused(showRequestAgain, { request }, { path: ADMIN_HIDDEN_PATH, notice: "own-request" }, hidden("request", request));
  });

  // --- 3 and 4. The same posts by a second admin, and Show again ----------------------------------------------------

  /** Posts as the signed-in account and says what changed: the log's growth, who was told what, the tags expired. */
  const changes = async (action: Action, fields: Record<string, string>) => {
    const before = await state(async () => null);
    const posted = await scenario().post(action, fields);
    const after = await state(async () => null);
    const told: Record<string, string[]> = {};
    PEOPLE.forEach((name, i) => {
      const fresh = after.notes[i].slice(before.notes[i].length);
      if (fresh.length > 0) told[name] = fresh.map((note) => note.kind);
    });
    return {
      redirect: posted.redirect,
      notice: (await scenario().notice(STAFF_NOTICE))?.notice ?? null,
      audit: after.audit - before.audit,
      told,
      tags: after.tags.slice(before.tags.length),
      texts: Object.fromEntries(PEOPLE.map((name, i) => [name, after.notes[i].slice(before.notes[i].length).map((note) => note.text)])),
    };
  };

  it("lets a second admin decide about the shop: one entry each, the owner and reporters told, the tag expired", async () => {
    await setUp();
    const { slug, listing, request, reports } = await ownThings();
    const shopperId = await world().signedIn("shopper");
    await world().setRoles("asker", ["admin"]);
    await world().setRoles("shopper", ["mentor"]);
    await scenario().signIn("asker");

    expect(await changes(verifySeller, { shop: slug, verified: "yes" })).toMatchObject({
      notice: "verified",
      audit: 1,
      told: { staff: ["shop-update"] },
      tags: ["sellers"],
    });
    expect(await changes(verifySeller, { shop: slug, verified: "yes" })).toMatchObject({ notice: "nothing", audit: 0, told: {}, tags: [] });

    expect(await changes(assignMentor, { shop: slug, mentor: shopperId })).toMatchObject({ notice: "mentor-assigned", audit: 1, told: {}, tags: [] });
    expect(await changes(assignMentor, { shop: slug, mentor: shopperId })).toMatchObject({ notice: "nothing", audit: 0 });

    expect(await changes(dismissReport, { report: reports.shop, note: "No problem found." })).toMatchObject({
      redirect: ADMIN_REPORTS_PATH,
      notice: "dismissed",
      audit: 1,
      told: { seller: ["report-handled"] },
      tags: [],
    });
    expect(await changes(dismissReport, { report: reports.shop, note: "No problem found." })).toMatchObject({ notice: "nothing", audit: 0, told: {} });

    expect(await changes(hideReportedListing, { report: reports.listing, reason: REASON })).toMatchObject({
      notice: "hidden",
      audit: 1,
      told: { staff: ["shop-update"], seller: ["report-handled"] },
      tags: ["listings"],
    });
    expect(await changes(hideReportedListing, { report: reports.listing, reason: REASON })).toMatchObject({ notice: "nothing", audit: 0, told: {} });

    expect(await changes(hideReportedRequest, { report: reports.request, reason: REASON })).toMatchObject({
      notice: "request-hidden",
      audit: 1,
      told: { staff: ["request-update"], seller: ["report-handled"] },
      tags: ["requests"],
    });

    // Show again: one entry, the owner told, the report stays closed; a second post changes nothing.
    const shown = await changes(showListingAgain, { listing });
    expect(shown).toMatchObject({ redirect: ADMIN_HIDDEN_PATH, notice: "listing-shown", audit: 1, told: { staff: ["shop-update"] }, tags: ["listings"] });
    expect(shown.texts.staff).toEqual([listingShownText("Contract staff's gated lamp")]);
    expect(await asStaff(() => getReport(reports.listing, null))).toMatchObject({ open: false, outcome: "hidden" });
    expect(await changes(showListingAgain, { listing })).toMatchObject({ notice: "nothing", audit: 0, told: {}, tags: [] });
    const shownRequest = await changes(showRequestAgain, { request });
    expect(shownRequest).toMatchObject({ notice: "request-shown", audit: 1, told: { staff: ["request-update"] }, tags: ["requests"] });
    expect(shownRequest.texts.staff).toEqual([requestShownText("A contract staff gated request")]);
    expect(await changes(showRequestAgain, { request })).toMatchObject({ notice: "nothing", audit: 0, told: {}, tags: [] });

    // The Hub's pause closes the open reports about the shop and its listings, and tells their reporters.
    await world().addReport("seller", { kind: "seller", id: slug });
    expect(await changes(pauseSeller, { shop: slug, reason: REASON })).toMatchObject({
      notice: "paused",
      audit: 1,
      told: { staff: ["shop-update"], seller: ["report-handled"] },
      tags: ["sellers"],
    });
    expect(await changes(pauseSeller, { shop: slug, reason: REASON })).toMatchObject({ notice: "nothing", audit: 0, told: {} });
    expect(await changes(resumeSeller, { shop: slug })).toMatchObject({ notice: "resumed", audit: 1, told: { staff: ["shop-update"] }, tags: ["sellers"] });

    // Featured: an entry each, nobody told, nothing expired.
    const day = addDays(sastDate(new Date()), 6);
    await world().forgetFeaturedDays([day]);
    expect(await changes(pinSeller, { seller: slug, campus: "all", day })).toMatchObject({ notice: "pinned", audit: 1, told: {}, tags: [] });
    expect(await changes(pinSeller, { seller: slug, campus: "all", day })).toMatchObject({ audit: 0, told: {} });
    expect((await scenario().notice(PIN_FORM))?.errors).toEqual(["pin-taken"]);
    const pin = (await asStaff(() => listPins(day, null))).find((item) => item.sellerSlug === slug)!;
    expect(await changes(unpinSeller, { pin: pin.id })).toMatchObject({ notice: "unpinned", audit: 1, told: {}, tags: [] });
    expect(await changes(unpinSeller, { pin: pin.id })).toMatchObject({ notice: "nothing", audit: 0 });
  });

  it("lets an admin approve and decline someone else's waiting shop, and pause a reported listing's shop", async () => {
    await setUp();
    await scenario().signIn("staff");
    const shopperId = await world().signedIn("shopper");
    const sellerId = await world().signedIn("seller");
    const approving = await world().openShop("shopper", { status: "pending" });
    const declining = await world().openShop("seller", { status: "pending" });
    expect(await changes(approveSeller, { shop: approving, owner: shopperId })).toMatchObject({
      notice: "approved",
      audit: 1,
      told: { shopper: ["shop-approved"] },
      tags: ["sellers"],
    });
    expect(await changes(approveSeller, { shop: approving, owner: shopperId })).toMatchObject({ notice: "nothing", audit: 0, told: {} });
    expect(await changes(declineSeller, { shop: declining, owner: sellerId, reason: REASON })).toMatchObject({
      notice: "declined",
      audit: 1,
      told: { seller: ["shop-update"] },
      tags: [],
    });
    expect(await changes(declineSeller, { shop: declining, owner: sellerId, reason: REASON })).toMatchObject({ notice: "nothing", audit: 0 });

    const listing = await world().addListing(approving, { title: "Contract reported shop's lamp" });
    const report = await world().addReport("asker", { kind: "listing", id: listing });
    expect(await changes(pauseReportedShop, { report, reason: REASON })).toMatchObject({
      notice: "report-paused",
      audit: 1,
      told: { shopper: ["shop-update"], asker: ["report-handled"] },
      tags: ["sellers"],
    });
    expect(await changes(pauseReportedShop, { report, reason: REASON })).toMatchObject({ notice: "nothing", audit: 0, told: {} });
  });

  it("writes the pickup points' entries, once each, and expires the points", async () => {
    await setUp();
    await scenario().signIn("staff");
    expect(await changes(addPoint, { campus: "pretoria", name: "Contract gated gate" })).toMatchObject({
      notice: "point-added",
      audit: 1,
      tags: ["pickup-points"],
    });
    const point = (await listPickupPoints()).find((row) => row.name === "Contract gated gate")!;
    expect(await changes(renamePoint, { point: point.id, name: "Contract renamed gate" })).toMatchObject({ notice: "point-renamed", audit: 1 });
    expect(await changes(renamePoint, { point: point.id, name: "Contract renamed gate" })).toMatchObject({ audit: 0 });
    expect(await changes(retirePoint, { point: point.id })).toMatchObject({ notice: "point-retired", audit: 1, tags: ["pickup-points"] });
    expect(await changes(retirePoint, { point: point.id })).toMatchObject({ notice: "nothing", audit: 0, tags: [] });
    expect(await changes(restorePoint, { point: point.id })).toMatchObject({ notice: "point-restored", audit: 1 });
    expect(await changes(restorePoint, { point: point.id })).toMatchObject({ notice: "nothing", audit: 0 });
  });

  // --- 5. Settle first ----------------------------------------------------------------------------------------------

  it("closes a request past its closing day before hiding it, and tells its asker both, in that order", async () => {
    await setUp();
    const staffId = (await scenario().signIn("staff"))!;
    const askerId = await world().signedIn("asker");
    const title = "A contract late reported request";
    const request = await world().addRequest({ asker: "asker", title, neededBy: addDays(sastDate(new Date()), -5) });
    const report = await world().addReport("seller", { kind: "request", id: request });
    expect(await changes(hideReportedRequest, { report, reason: REASON })).toMatchObject({ notice: "request-hidden", audit: 1 });
    expect(await world().asViewer("asker", () => getOwnRequest(askerId, request, new Date()))).toMatchObject({
      closedAt: expect.any(String),
      closedAutomatically: true,
      closeReason: "needed-by",
      hiddenReason: REASON,
    });
    const told = (await world().notificationsOf("asker")).filter((note) => note.subjectId === request).map((note) => note.text);
    expect(told).toEqual([requestAutoClosedText(title, "needed-by"), requestHiddenText(title)]);
    expect(staffId).not.toBe(askerId);
  });
}
