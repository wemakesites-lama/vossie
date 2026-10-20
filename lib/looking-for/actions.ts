"use server";

import { redirect, RedirectType } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { getCampuses, getCategories } from "@/lib/data";
import { startOffer } from "@/lib/data/messages";
import { countOffersSince } from "@/lib/data/offers";
import {
  countOpenRequests,
  countRequestsSince,
  createRequest,
  deleteRequest,
  getOwnRequest,
  setRequestOpen,
  updateRequest,
} from "@/lib/data/requests";
import { requestsChanged } from "@/lib/data/tags";
import { clearOwnFormState } from "@/lib/messaging/form-state";
import { messageLimitErrors } from "@/lib/messaging/limits";
import { isId, sentNoteKey, threadPath } from "@/lib/messaging/paths";
import { checkMessage, DAY_MS, keepTyped } from "@/lib/messaging/rules";
import { scamWarnings } from "@/lib/messaging/scam-check";
import { done, field } from "@/lib/selling/action-helpers";
import { leaveOnceToken, sentOnceToken, takeOnceToken } from "@/lib/staff/once";
import { sastDate } from "@/lib/time";
import {
  deleteRequestPath,
  editRequestPath,
  NEW_REQUEST_PATH,
  offerFormKey,
  offerPath,
  requestFormKey,
  requestNoteKey,
  requestPath,
  YOUR_REQUESTS_FORM,
  YOUR_REQUESTS_PATH,
} from "./paths";
import {
  checkRequest,
  OFFERS_PER_DAY,
  OPEN_REQUESTS_MAX,
  REQUESTS_PER_DAY,
  type RequestContext,
  type RequestError,
  type RequestInput,
} from "./rules";
import { offerStatus, offerSubject } from "./subjects";

// The Server Actions behind Looking For's forms (community actions spec 2.2 to 2.6 and 2.9). Each is a plain form's
// action, so it works before the app's JavaScript arrives. It checks its own input, takes identity only from the
// session, keeps errors and typed values in D's form state (never the URL), and ends with a redirect that replaces the
// form in history. A write expires the "requests" tag, leaves a status line for the page it lands on (plan decision
// 7), and ends with F's done(), whose refresh() makes the browser drop its kept pages.

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** An id from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = field(formData, name);
  return isId(value) ? value : null;
}

/** Back to the form after a post that changed nothing (E's back): no refresh. */
function back(path: string): never {
  redirect(path, RedirectType.replace);
}

/** A status line for the page the action lands on (plan decision 7). */
async function leaveNote(form: string, notice: string, now: Date): Promise<void> {
  await writeFormState(form, { errors: [], values: {}, notice }, now);
}

// --- The request form (spec 2.3 to 2.5) -----------------------------------------------------------------------------

function requestInput(formData: FormData): RequestInput {
  return {
    title: field(formData, "title"),
    categorySlug: field(formData, "category"),
    campusSlug: field(formData, "campus"),
    details: field(formData, "details"),
    budget: field(formData, "budget"),
    swap: field(formData, "swap") === "yes",
    neededBy: field(formData, "neededBy"),
  };
}

/** The categories and campuses there are. */
type Choices = Pick<RequestContext, "categorySlugs" | "campusSlugs">;

/** A choice field's posted value when it is one of its choices, else nothing: form state holds no stranger's text. */
const known = (raw: string, choices: readonly string[]) => (choices.includes(raw) ? raw : "");

/**
 * What was typed, for the form to show again after a failed post (E's keepTyped caps the long fields). The category and
 * the campus are kept only when they are ones that exist, as selling's listing form does (plan amendment 19.8).
 */
function typedValues(input: RequestInput, choices: Choices): Record<string, string> {
  return {
    title: keepTyped(input.title),
    category: known(input.categorySlug, choices.categorySlugs),
    campus: known(input.campusSlug, choices.campusSlugs),
    details: keepTyped(input.details),
    budget: keepTyped(input.budget),
    swap: input.swap ? "yes" : "",
    neededBy: keepTyped(input.neededBy),
  };
}

/**
 * Post request and Save changes (spec 2.3 to 2.6): the fields checked on the server, contact details refused, and for
 * a new request the open and daily limits (plan decision 4). The request's page then says what happened. Only the
 * asker's open request can be edited (plan decision 6).
 *
 * A new request is made once, however many times its form is sent (plan amendment 3, as selling's new listing and the
 * Hub's new post are): the form carries a one-time token, and only the first post to take it makes a request. A later
 * one goes where the first went, even when the first took the account to a limit; one with no token, or a made-up or
 * run-out one, is refused with the form's error and what was typed. The token is taken only when a request is about
 * to be made, so a post that fails its checks keeps it.
 */
export async function saveMyRequest(formData: FormData): Promise<void> {
  const editing = idFrom(formData, "request");
  const path = editing ? editRequestPath(editing) : NEW_REQUEST_PATH;
  const account = await requireAccount(path);
  const now = new Date();
  // The date an edited request holds already may have passed; only a changed date must be today or later (amendment 19.6).
  let keptNeededBy: string | null = null;
  if (editing) {
    const own = await getOwnRequest(account.id, editing);
    if (!own) redirect(YOUR_REQUESTS_PATH);
    // The edit page says why a closed or hidden request can't be changed.
    if (own.state !== "open") back(path);
    keptNeededBy = own.request.neededBy;
  }
  // A token that has made its request already: go where that post went, before any limit can turn this one away.
  const once = editing ? "" : field(formData, "once");
  const earlier = once ? await sentOnceToken(once, now) : null;
  if (earlier) done(earlier.path);
  const form = requestFormKey(editing);
  const [categories, campuses] = await Promise.all([getCategories(), getCampuses()]);
  const input = requestInput(formData);
  const choices = {
    categorySlugs: categories.map((category) => category.slug),
    campusSlugs: campuses.map((campus) => campus.slug),
  };
  const check = checkRequest(input, { ...choices, today: sastDate(now), keptNeededBy });
  const errors: RequestError[] = [...check.errors];
  if (!editing && errors.length === 0) {
    if ((await countOpenRequests(account.id)) >= OPEN_REQUESTS_MAX) errors.push("open-limit");
    else if ((await countRequestsSince(account.id, new Date(now.getTime() - DAY_MS))) >= REQUESTS_PER_DAY) {
      errors.push("daily-limit");
    }
  }
  if (errors.length > 0 || !check.value) {
    await writeFormState(form, { errors, values: typedValues(input, choices), notice: null }, now);
    back(path);
  }
  // Only now, with a request about to be made, is the token taken. Taking it is one step, so of two posts sent together
  // only one makes the request; the other goes to the first's page, or to Your requests while the first is still saving.
  if (!editing) {
    const token = await takeOnceToken(once, now);
    if (token.kind === "none") {
      const values = typedValues(input, choices);
      await writeFormState(form, { errors: ["form-expired"], values, notice: null }, now);
      back(path);
    }
    if (token.kind === "again") done(token.sent?.path ?? YOUR_REQUESTS_PATH);
  }
  const saved = editing
    ? await updateRequest(account.id, editing, check.value, now)
    : await createRequest({ askerId: account.id, fields: check.value, now });
  if (!saved) redirect(YOUR_REQUESTS_PATH);
  await clearOwnFormState(form);
  await leaveNote(requestNoteKey(saved.id), editing ? "saved" : "posted", now);
  requestsChanged();
  if (!editing) await leaveOnceToken(once, { path: requestPath(saved.id), notice: "posted" }, now);
  done(requestPath(saved.id));
}

// --- Close, Reopen and Delete (spec 2.6) ------------------------------------------------------------------------------

/**
 * Close or Reopen, from the request's page or from Your requests (`from=list`), landing back where it came from with a
 * status line (plan decisions 6 and 7). Reopening counts towards the 5 open (spec 2.6). A press that changes nothing
 * (someone else's request, a hidden one, a second press) says nothing.
 */
async function changeOpen(formData: FormData, open: boolean): Promise<void> {
  const id = idFrom(formData, "request");
  const landing = id && field(formData, "from") !== "list" ? requestPath(id) : YOUR_REQUESTS_PATH;
  const account = await requireAccount(landing);
  if (!id) done(YOUR_REQUESTS_PATH);
  const now = new Date();
  const note = landing === YOUR_REQUESTS_PATH ? YOUR_REQUESTS_FORM : requestNoteKey(id);
  if (open && (await getOwnRequest(account.id, id))?.state === "closed") {
    if ((await countOpenRequests(account.id)) >= OPEN_REQUESTS_MAX) {
      await leaveNote(note, "reopen-limit", now);
      done(landing);
    }
  }
  if (await setRequestOpen(account.id, id, open, now)) {
    requestsChanged();
    await leaveNote(note, open ? "reopened" : "closed", now);
  }
  done(landing);
}

/** Close: "Found it? Close it so shops stop offering." */
export async function closeMyRequest(formData: FormData): Promise<void> {
  await changeOpen(formData, false);
}

export async function reopenMyRequest(formData: FormData): Promise<void> {
  await changeOpen(formData, true);
}

/** Delete request, from its confirm page (spec 2.6): it goes, its page 404s, and Your requests says so. */
export async function deleteMyRequest(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  const account = await requireAccount(id ? deleteRequestPath(id) : YOUR_REQUESTS_PATH);
  if (id && (await deleteRequest(account.id, id))) {
    requestsChanged();
    await leaveNote(YOUR_REQUESTS_FORM, "deleted", new Date());
  }
  done(YOUR_REQUESTS_PATH);
}

// --- Offers (spec 2.7 to 2.9) -------------------------------------------------------------------------------------

/**
 * Send offer, from the composer (spec 2.9): only when the composer would show its form (plan decision 12); the message
 * checked with E's rules, then at most 20 a shop in 24 hours and stage K's 120 messages an hour, then E's scam words
 * unless Send anyway was pressed; a listing only if it's one of the shop's listed ones (plan decision 13). The thread
 * then says "Sent." once (E's note).
 */
export async function sendOffer(formData: FormData): Promise<void> {
  const id = idFrom(formData, "request");
  if (!id) redirect("/looking-for");
  const path = offerPath(id);
  const account = await requireAccount(path);
  const subject = await offerSubject(id);
  if (!subject) redirect("/looking-for");
  const status = await offerStatus(subject, account);
  // The composer says why anyone else can't offer; a post that arrives anyway just goes back to it.
  if (status.kind !== "open") back(path);
  const now = new Date();
  const form = offerFormKey(id);
  const message = checkMessage(field(formData, "body"));
  const pointed = status.listings.find((listing) => listing.id === field(formData, "listing")) ?? null;
  const values = { body: keepTyped(message.value), listing: pointed?.id ?? "" };
  if (message.error) {
    await writeFormState(form, { errors: [message.error], values, notice: null }, now);
    back(path);
  }
  if ((await countOffersSince(status.shopSlug, new Date(now.getTime() - DAY_MS))) >= OFFERS_PER_DAY) {
    await writeFormState(form, { errors: ["offer-rate"], values, notice: null }, now);
    back(path);
  }
  // The hour's messages (stage K spec decision 9): after the shop's daily offers, before the scam words, so a refusal
  // never follows a "Check this before you send" (plan decision 14).
  const limits = await messageLimitErrors(account, { newConversation: false }, now);
  if (limits.length > 0) {
    await writeFormState(form, { errors: limits, values, notice: null }, now);
    back(path);
  }
  const warnings = field(formData, "anyway") === "yes" ? [] : scamWarnings(message.value);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { ...values, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  const conversationId = await startOffer({
    askerId: status.askerId,
    request: { id, title: subject.request.title },
    sellerSlug: status.shopSlug,
    listing: pointed,
    body: message.value,
    now,
  });
  await clearOwnFormState(form);
  await writeFormState(sentNoteKey(conversationId), { errors: [], values: {}, notice: "sent" }, now);
  requestsChanged();
  done(threadPath(conversationId));
}
