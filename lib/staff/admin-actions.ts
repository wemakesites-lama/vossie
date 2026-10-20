"use server";

import { writeFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES, ONLINE_CAMPUS } from "@/lib/campus";
import { getCampuses, getSeller } from "@/lib/data";
import { recordAudit } from "@/lib/data/audit";
import { addPin, removePin } from "@/lib/data/featured";
import { notify } from "@/lib/data/notifications";
import {
  addPickupPoint,
  isPointNameTaken,
  pickupPointById,
  renamePickupPoint,
  restorePickupPoint,
  retirePickupPoint,
} from "@/lib/data/pickup-points";
import { hideRequest, showRequest } from "@/lib/data/requests";
import {
  closeReport,
  closeReportsAboutShop,
  closeReportsOn,
  getReport,
  type ClosedReport,
} from "@/lib/data/staff-reports";
import {
  approveShop,
  declineShop,
  hideListing,
  setShopMentor,
  setVerified,
  showListing,
  staffPauseShop,
  staffResumeShop,
  type ShopDecision,
} from "@/lib/data/staff-shops";
import { listingsChanged, pickupPointsChanged, requestsChanged, sellersChanged } from "@/lib/data/tags";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { requestHiddenText } from "@/lib/looking-for/words";
import { isId } from "@/lib/messaging/paths";
import { keepTyped } from "@/lib/messaging/rules";
import { done, field } from "@/lib/selling/action-helpers";
import { myListingsPath, SELL_PATH, tabFor } from "@/lib/selling/paths";
import { sastDate } from "@/lib/time";
import type { Account } from "@/lib/types";
import { requireStaff } from "./access";
import {
  clearStaffForm,
  declineForm,
  dismissForm,
  hideForm,
  leaveNotice,
  PIN_FORM,
  pointAddForm,
  pointRenameForm,
  reportPauseForm,
  shopPauseForm,
} from "./form-state";
import {
  listingHiddenText,
  listingShownText,
  reportOutcomeText,
  requestShownText,
  shopApprovedText,
  shopDecisionText,
} from "./notification-text";
import {
  ADMIN_FEATURED_PATH,
  ADMIN_HIDDEN_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_REPORTS_PATH,
  ADMIN_SELLERS_PATH,
  adminReportPath,
  adminSellerPath,
  declineSellerPath,
  hideReportedPath,
  pauseReportedPath,
  pauseSellerPath,
  showListingPath,
  showRequestPath,
} from "./paths";
import { checkDismissNote, checkPinDay, checkPointName, checkReason } from "./rules";

// The admin console's Server Actions (staff tools spec 2.2 and 2.3). Each is a plain form's action, so it works
// before the app's JavaScript arrives. It checks the role first (a forged post gets the 404, plan decision 1),
// validates on the server, keeps errors and typed text in D's form state, changes the store through lib/data, and
// writes one audit entry, only when something changed (plan decisions 6 and 23). Then it tells whoever the spec says,
// expires what buyers' pages read, leaves a notice, and ends with done(): refresh, then a replace redirect.

// --- Shared helpers ---------------------------------------------------------------------------------------------

/** An id or slug from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return isId(value) ? value : null;
}

const staffOf = (account: Account) => ({ id: account.id, firstName: account.firstName });

/** A change that didn't happen (plan decision 23): no audit entry, nothing sent, and the page says so. */
async function nothingChanged(path: string, now: Date): Promise<never> {
  await leaveNotice("nothing", now);
  done(path);
}

/** Tells a shop's owner about the Hub's decision (plan decision 7). A sample shop has no owner to tell. */
async function tellOwner(
  decision: ShopDecision,
  what: "declined" | "paused" | "resumed" | "lifted" | "verified" | "unverified",
  now: Date,
): Promise<void> {
  if (!decision.ownerId) return;
  await notify({
    accountId: decision.ownerId,
    kind: "shop-update",
    subjectId: decision.slug,
    text: shopDecisionText(what, decision.name),
    href: SELL_PATH,
    now,
  });
}

/** Where a reporter's notification goes: the heading of "Reports you've made" on privacy settings (amendment 8). */
const REPORTS_MADE_PATH = "/account/privacy#account-privacy-reports-title";

/** Tells a reporter what happened to their report (spec 2.3), on privacy settings' "Reports you've made". */
async function tellReporter(closed: ClosedReport, outcome: "acted" | "dismissed", now: Date): Promise<void> {
  await notify({
    accountId: closed.reporterId,
    kind: "report-handled",
    subjectId: closed.id,
    text: reportOutcomeText(outcome, closed.title),
    href: REPORTS_MADE_PATH,
    now,
  });
}

/** Keeps a confirm page's or a form's errors and typed reason, and goes back to it. */
async function backWithReason(form: string, error: string, typed: string, path: string, now: Date): Promise<never> {
  await writeFormState(form, { errors: [error], values: { reason: keepTyped(typed) }, notice: null }, now);
  done(path);
}

// --- Sellers (spec 2.3) -------------------------------------------------------------------------------------------

/** Approve: a waiting shop opens (plan decision 2), and its owner is told. */
export async function approveSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  // The owner of the shop the Hub reviewed: a decision acts only on that shop (amendment 14.6).
  const owner = idFrom(formData, "owner");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const decision = slug && owner ? await approveShop(slug, owner, now) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-approved",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  if (decision.ownerId) {
    await notify({
      accountId: decision.ownerId,
      kind: "shop-approved",
      subjectId: decision.slug,
      text: shopApprovedText(decision.name),
      href: SELL_PATH,
      now,
    });
  }
  sellersChanged();
  await leaveNotice("approved", now);
  done(path);
}

/** Decline, from its confirm page (plan decisions 2 and 18): the reason is required, and the seller sees it on /sell. */
export async function declineSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const owner = idFrom(formData, "owner");
  const staff = await requireStaff("admin", slug ? declineSellerPath(slug) : ADMIN_SELLERS_PATH);
  const now = new Date();
  if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(declineForm(slug), reason.error, reason.value, declineSellerPath(slug), now);
  const decision = owner ? await declineShop(slug, owner, reason.value, now) : null;
  if (!decision) return nothingChanged(adminSellerPath(slug), now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-declined",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "declined", now);
  await clearStaffForm(declineForm(slug));
  await leaveNotice("declined", now);
  done(adminSellerPath(slug));
}

/** Verify, or remove Verified (spec 2.3): `verified` is "yes" or "no". */
export async function verifySeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const verified = field(formData, "verified") === "yes";
  const decision = slug ? await setVerified(slug, verified) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: verified ? "shop-verified" : "shop-unverified",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, verified ? "verified" : "unverified", now);
  sellersChanged();
  await leaveNotice(verified ? "verified" : "unverified", now);
  done(path);
}

/** The Hub's Pause shop, from its confirm page (plan decisions 3 and 18). */
export async function pauseSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const staff = await requireStaff("admin", slug ? pauseSellerPath(slug) : ADMIN_SELLERS_PATH);
  const now = new Date();
  if (!slug) return nothingChanged(ADMIN_SELLERS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(shopPauseForm(slug), reason.error, reason.value, pauseSellerPath(slug), now);
  const decision = await staffPauseShop(slug, reason.value);
  if (!decision) return nothingChanged(adminSellerPath(slug), now);
  // Pausing from the shop's page closes the reports about it too, so no reporter is later told the Hub found no
  // problem with a shop it paused (amendment 14.1).
  const reports = await closeReportsAboutShop(decision.slug, reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-paused",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "paused", now);
  for (const closed of reports) await tellReporter(closed, "acted", now);
  sellersChanged();
  await clearStaffForm(shopPauseForm(slug));
  await leaveNotice("paused", now);
  done(adminSellerPath(slug));
}

/** The Hub's Resume: only its own pause (plan decision 3). Nothing is lost, so no confirm page. */
export async function resumeSeller(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const decision = slug ? await staffResumeShop(slug) : null;
  if (!decision) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-resumed",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    subjectId: decision.ownerId,
    now,
  });
  // The seller's own pause stays under the Hub's, so buyers still can't see the shop.
  await tellOwner(decision, decision.stillPausedBySeller ? "lifted" : "resumed", now);
  sellersChanged();
  await leaveNotice("resumed", now);
  done(path);
}

/** A shop's mentor (spec 2.6, plan decision 15): `mentor` is an account with the mentor role, or "" for none. */
export async function assignMentor(formData: FormData): Promise<void> {
  const slug = idFrom(formData, "shop");
  const path = slug ? adminSellerPath(slug) : ADMIN_SELLERS_PATH;
  const staff = await requireStaff("admin", path);
  const now = new Date();
  const raw = field(formData, "mentor");
  const mentorId = raw === "" ? null : isId(raw) ? raw : undefined;
  const changed = slug && mentorId !== undefined ? await setShopMentor(slug, mentorId) : null;
  if (!changed) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: changed.mentorName ? "mentor-assigned" : "mentor-removed",
    target: { kind: "shop", id: changed.slug, name: changed.name },
    detail: changed.mentorName ?? "",
    subjectId: changed.ownerId,
    now,
  });
  await leaveNotice(changed.mentorName ? "mentor-assigned" : "mentor-removed", now);
  done(path);
}

// --- Reports (spec 2.3, plan decision 5) --------------------------------------------------------------------------

/** Dismiss (with a note): this report closes, and its reporter hears the Hub didn't find a problem. */
export async function dismissReport(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? adminReportPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  if (!id) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const note = checkDismissNote(field(formData, "note"));
  if (note.error) {
    await writeFormState(dismissForm(id), { errors: [note.error], values: { note: keepTyped(note.value) }, notice: null }, now);
    done(adminReportPath(id));
  }
  const closed = await closeReport(id, note.value, staff.id, now);
  if (!closed) return nothingChanged(ADMIN_REPORTS_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "report-dismissed",
    target: { kind: "report", id, name: closed.title },
    detail: note.value,
    subjectId: closed.reporterId,
    now,
  });
  await tellReporter(closed, "dismissed", now);
  await clearStaffForm(dismissForm(id));
  await leaveNotice("dismissed", now);
  done(ADMIN_REPORTS_PATH);
}

/**
 * Hide the listing, from its confirm page (plan decisions 4, 5 and 18): it leaves every list and its page, every open
 * report on it closes, its seller sees why in My listings, and each reporter hears the Hub acted.
 */
export async function hideReportedListing(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? hideReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.hide || view.target.kind !== "listing") return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(hideForm(id), reason.error, reason.value, hideReportedPath(id), now);
  const hidden = await hideListing(view.target.id, reason.value, now);
  if (!hidden) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reports = await closeReportsOn(view.target, "hidden", reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "listing-hidden",
    target: { kind: "listing", id: hidden.id, name: hidden.title },
    detail: reason.value,
    subjectId: hidden.ownerId,
    now,
  });
  if (hidden.ownerId) {
    await notify({
      accountId: hidden.ownerId,
      kind: "shop-update",
      subjectId: hidden.id,
      text: listingHiddenText(hidden.title),
      href: myListingsPath(tabFor(hidden.state)),
      now,
    });
  }
  for (const closed of reports) await tellReporter(closed, "acted", now);
  listingsChanged();
  await clearStaffForm(hideForm(id));
  await leaveNotice("hidden", now);
  done(ADMIN_REPORTS_PATH);
}

/**
 * Hide the request, from the same confirm page (community actions spec 2.14, plan decision 20): it leaves the board,
 * the homepage and the sitemap, and its page 404s; every open report on it closes; its asker hears the Hub hid it and
 * sees why in Your requests; each reporter hears the Hub acted.
 */
export async function hideReportedRequest(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? hideReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.hide || view.target.kind !== "request") return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) {
    // The asker reads the reason, so the missing-reason error doesn't say "the seller".
    const code = reason.error === "reason-missing" ? "reason-missing-asker" : reason.error;
    return backWithReason(hideForm(id), code, reason.value, hideReportedPath(id), now);
  }
  const hidden = await hideRequest(view.target.id, reason.value, now);
  if (!hidden) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reports = await closeReportsOn(view.target, "hidden", reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "request-hidden",
    target: { kind: "request", id: hidden.id, name: hidden.title },
    detail: reason.value,
    subjectId: hidden.askerId,
    now,
  });
  if (hidden.askerId) {
    await notify({
      accountId: hidden.askerId,
      kind: "request-update",
      subjectId: hidden.id,
      text: requestHiddenText(hidden.title),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  for (const closed of reports) await tellReporter(closed, "acted", now);
  requestsChanged();
  await clearStaffForm(hideForm(id));
  await leaveNotice("request-hidden", now);
  done(ADMIN_REPORTS_PATH);
}

/**
 * Pause the account, from its confirm page (plan decisions 3, 5 and 18): the reported shop, or the reported listing's
 * shop, pauses as the Hub's pause; every open report on the shop and its listings closes (amendment 14.1); the seller and
 * each reporter are told.
 */
export async function pauseReportedShop(formData: FormData): Promise<void> {
  const id = idFrom(formData, "report");
  const staff = await requireStaff("admin", id ? pauseReportedPath(id) : ADMIN_REPORTS_PATH);
  const now = new Date();
  const view = id ? await getReport(id) : null;
  if (!id || !view?.can.pause || !view.shop) return nothingChanged(ADMIN_REPORTS_PATH, now);
  const reason = checkReason(field(formData, "reason"));
  if (reason.error) return backWithReason(reportPauseForm(id), reason.error, reason.value, pauseReportedPath(id), now);
  const decision = await staffPauseShop(view.shop.slug, reason.value);
  if (!decision) return nothingChanged(ADMIN_REPORTS_PATH, now);
  // Every open report about the shop or its listings closes, not only the ones on this report's own target.
  const reports = await closeReportsAboutShop(decision.slug, reason.value, staff.id, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "shop-paused",
    target: { kind: "shop", id: decision.slug, name: decision.name },
    detail: reason.value,
    subjectId: decision.ownerId,
    now,
  });
  await tellOwner(decision, "paused", now);
  for (const closed of reports) await tellReporter(closed, "acted", now);
  sellersChanged();
  await clearStaffForm(reportPauseForm(id));
  await leaveNotice("report-paused", now);
  done(ADMIN_REPORTS_PATH);
}

// --- Featured (spec 2.8, plan decision 9) -------------------------------------------------------------------------

/** "All" as the Featured page and the log call it. */
const NO_CAMPUS = "No campus chosen";

const PIN_ERRORS: Readonly<Record<"not-eligible" | "taken" | "full", string>> = {
  "not-eligible": "seller-not-eligible",
  taken: "pin-taken",
  full: "pin-full",
};

/** Pin a Verified seller to a campus (or visitors with none chosen) for a day, before the draw. */
export async function pinSeller(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_FEATURED_PATH);
  const now = new Date();
  const seller = idFrom(formData, "seller");
  const campus = field(formData, "campus");
  const campusName =
    campus === ALL_CAMPUSES ? NO_CAMPUS : (await getCampuses()).find((item) => item.slug === campus)?.name;
  const day = checkPinDay(field(formData, "day"), sastDate(now));
  const errors: string[] = [];
  if (!seller) errors.push("seller-missing");
  if (!campusName) errors.push("campus-missing");
  if (day.error) errors.push(day.error);
  if (seller && campusName && !day.error) {
    const pin = await addPin({ sellerSlug: seller, campusSlug: campus, day: day.value, staffId: staff.id, now });
    if (typeof pin !== "string") {
      const name = (await getSeller(pin.sellerSlug))?.name ?? pin.sellerSlug;
      await recordAudit({
        staff: staffOf(staff),
        action: "featured-pinned",
        target: { kind: "shop", id: pin.sellerSlug, name },
        detail: `${campusName} · ${pin.day}`,
        now,
      });
      await clearStaffForm(PIN_FORM);
      await leaveNotice("pinned", now);
      done(ADMIN_FEATURED_PATH);
    }
    errors.push(PIN_ERRORS[pin]);
  }
  const values = {
    seller: keepTyped(field(formData, "seller")),
    campus: keepTyped(campus),
    day: keepTyped(field(formData, "day")),
  };
  await writeFormState(PIN_FORM, { errors, values, notice: null }, now);
  done(ADMIN_FEATURED_PATH);
}

/** Remove a pin: that campus's row for the day is drawn again. */
export async function unpinSeller(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_FEATURED_PATH);
  const now = new Date();
  const id = idFrom(formData, "pin");
  const pin = id ? await removePin(id) : null;
  if (!pin) return nothingChanged(ADMIN_FEATURED_PATH, now);
  const campusName =
    pin.campusSlug === ALL_CAMPUSES
      ? NO_CAMPUS
      : ((await getCampuses()).find((item) => item.slug === pin.campusSlug)?.name ?? pin.campusSlug);
  await recordAudit({
    staff: staffOf(staff),
    action: "featured-unpinned",
    target: { kind: "shop", id: pin.sellerSlug, name: (await getSeller(pin.sellerSlug))?.name ?? pin.sellerSlug },
    detail: `${campusName} · ${pin.day}`,
    now,
  });
  await leaveNotice("unpinned", now);
  done(ADMIN_FEATURED_PATH);
}

// --- Pickup points (spec 2.3, plan decision 10) -------------------------------------------------------------------

/** The admin page, at a campus's points. */
const pointsPath = (campusSlug: string) => `${ADMIN_POINTS_PATH}#points-${campusSlug}`;

/** Add a point to a physical campus. Eduvos Online has none. */
export async function addPoint(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const chosen = field(formData, "campus");
  const campus = (await getCampuses()).find((item) => item.slug === chosen && item.slug !== ONLINE_CAMPUS);
  if (!campus) return nothingChanged(ADMIN_POINTS_PATH, now);
  const path = pointsPath(campus.slug);
  const name = checkPointName(field(formData, "name"));
  const error = name.error ?? ((await isPointNameTaken(campus.slug, name.value, null)) ? "point-name-taken" : null);
  if (error) {
    const values = { name: keepTyped(field(formData, "name")) };
    await writeFormState(pointAddForm(campus.slug), { errors: [error], values, notice: null }, now);
    done(path);
  }
  const row = await addPickupPoint(campus.slug, name.value, now);
  if (!row) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "point-added",
    target: { kind: "pickup-point", id: row.id, name: row.name },
    detail: campus.name,
    now,
  });
  pickupPointsChanged();
  await clearStaffForm(pointAddForm(campus.slug));
  await leaveNotice("point-added", now);
  done(path);
}

/** Rename a point: listings that use it follow, as they keep its id. */
export async function renamePoint(formData: FormData): Promise<void> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const id = idFrom(formData, "point");
  const point = id ? pickupPointById(id) : null;
  if (!point) return nothingChanged(ADMIN_POINTS_PATH, now);
  const path = pointsPath(point.campusSlug);
  const name = checkPointName(field(formData, "name"));
  const error = name.error ?? ((await isPointNameTaken(point.campusSlug, name.value, point.id)) ? "point-name-taken" : null);
  if (error) {
    const values = { name: keepTyped(field(formData, "name")) };
    await writeFormState(pointRenameForm(point.id), { errors: [error], values, notice: null }, now);
    done(path);
  }
  const renamed = await renamePickupPoint(point.id, name.value);
  if (!renamed) return nothingChanged(path, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "point-renamed",
    target: { kind: "pickup-point", id: point.id, name: name.value },
    detail: `Was ${renamed.before}`,
    now,
  });
  pickupPointsChanged();
  await clearStaffForm(pointRenameForm(point.id));
  await leaveNotice("point-renamed", now);
  done(path);
}

/** Retire, or Use it again (plan decision 10): neither loses anything, so neither has a confirm page. */
async function setRetired(formData: FormData, retire: boolean): Promise<never> {
  const staff = await requireStaff("admin", ADMIN_POINTS_PATH);
  const now = new Date();
  const id = idFrom(formData, "point");
  const row = id ? await (retire ? retirePickupPoint(id, now) : restorePickupPoint(id)) : null;
  if (!row) return nothingChanged(ADMIN_POINTS_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: retire ? "point-retired" : "point-restored",
    target: { kind: "pickup-point", id: row.id, name: row.name },
    now,
  });
  pickupPointsChanged();
  await leaveNotice(retire ? "point-retired" : "point-restored", now);
  done(pointsPath(row.campusSlug));
}

export async function retirePoint(formData: FormData): Promise<void> {
  await setRetired(formData, true);
}

export async function restorePoint(formData: FormData): Promise<void> {
  await setRetired(formData, false);
}

// --- Show again (stage J spec decision 14) ----------------------------------------------------------------------

/**
 * Show the listing again, from its confirm page: the mirror of Hide the listing. Its seller is told and buyers' pages
 * read it again. The reports that closed stay closed and their reporters aren't told again; followers and saved
 * searches aren't told, since it isn't a first publish. Its own state (sold, paused, a draft) stays.
 */
export async function showListingAgain(formData: FormData): Promise<void> {
  const id = idFrom(formData, "listing");
  const staff = await requireStaff("admin", id ? showListingPath(id) : ADMIN_HIDDEN_PATH);
  const now = new Date();
  const shown = id ? await showListing(id) : null;
  if (!shown) return nothingChanged(ADMIN_HIDDEN_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "listing-shown",
    target: { kind: "listing", id: shown.id, name: shown.title },
    subjectId: shown.ownerId,
    now,
  });
  if (shown.ownerId) {
    await notify({
      accountId: shown.ownerId,
      kind: "shop-update",
      subjectId: shown.id,
      text: listingShownText(shown.title),
      href: myListingsPath(tabFor(shown.state)),
      now,
    });
  }
  listingsChanged();
  await leaveNotice("listing-shown", now);
  done(ADMIN_HIDDEN_PATH);
}

/**
 * Show the request again, from its confirm page: the mirror of Hide the request. Its asker is told and the board, the
 * homepage, the sitemap and its page read it again. Open or closed stays as its asker left it.
 */
export async function showRequestAgain(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  const staff = await requireStaff("admin", id ? showRequestPath(id) : ADMIN_HIDDEN_PATH);
  const now = new Date();
  const shown = id ? await showRequest(id, now) : null;
  if (!shown) return nothingChanged(ADMIN_HIDDEN_PATH, now);
  await recordAudit({
    staff: staffOf(staff),
    action: "request-shown",
    target: { kind: "request", id: shown.id, name: shown.title },
    subjectId: shown.askerId,
    now,
  });
  if (shown.askerId) {
    await notify({
      accountId: shown.askerId,
      kind: "request-update",
      subjectId: shown.id,
      text: requestShownText(shown.title),
      href: YOUR_REQUESTS_PATH,
      now,
    });
  }
  requestsChanged();
  await leaveNotice("request-shown", now);
  done(ADMIN_HIDDEN_PATH);
}
