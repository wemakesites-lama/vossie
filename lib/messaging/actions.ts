"use server";

import { refresh } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { confirmSale, markCompleted, rejectSale, sendMessage, startConversation } from "@/lib/data/messages";
import { countReportsSince, createReport, hasOpenReport } from "@/lib/data/reports";
import type { ReportTarget } from "@/lib/types";
import { clearOwnFormState } from "./form-state";
import {
  composerFormKey,
  composerPath,
  isId,
  replyFormKey,
  reportFormKey,
  reportPath,
  reportSentPath,
  sentNoteKey,
  threadPath,
  type MessageTarget,
} from "./paths";
import { checkMessage, checkReportDetail, checkSwapOffer, DAY_MS, keepTyped, parseReason, REPORTS_PER_DAY } from "./rules";
import { scamWarnings } from "./scam-check";
import { composerSubject, reportSubject, shopSlugOf } from "./subjects";

// The Server Actions behind messaging's forms (messaging spec 2 and 3). Each is a plain form's action, so it works
// before the app's JavaScript arrives. It checks its own input, takes identity only from the session, keeps errors
// and the scam warning in form state rather than the URL (D decision 3), and ends with a redirect that replaces the
// form in history. Every write ends with done(), whose refresh() makes the browser drop its kept pages (plan
// decision 6).

// --- Shared helpers -------------------------------------------------------------------------------------------------

/** A form field as text. A missing field, or a file, is "". */
function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** An id or slug from a hidden field, when it's one this site could have made. */
function idFrom(formData: FormData, name: string): string | null {
  const value = text(formData, name);
  return isId(value) ? value : null;
}

/** Back to the form, which shows the state just saved. */
function back(path: string): never {
  redirect(path, RedirectType.replace);
}

/**
 * The end of every write (plan decision 6): refresh() tells the browser its kept pages are out of date, and the
 * redirect replaces the form in history, so Back skips a form that has been sent.
 */
function done(path: string): never {
  refresh();
  redirect(path, RedirectType.replace);
}

// --- Messages ---------------------------------------------------------------------------------------------------------

function messageTargetFrom(formData: FormData): MessageTarget | null {
  const listingId = idFrom(formData, "listing");
  if (listingId) return { kind: "listing", listingId };
  const sellerSlug = idFrom(formData, "shop");
  return sellerSlug ? { kind: "shop", sellerSlug } : null;
}

/**
 * The composer's Send (spec 3.1). The message and swap offer are checked, then the scam words unless Send anyway was
 * pressed (spec 2.3, plan decision 9). Then the conversation starts, or the message joins the buyer's existing one
 * (plan decision 5), and the thread says "Sent." once (plan decision 7).
 */
export async function sendFirstMessage(formData: FormData): Promise<void> {
  const target = messageTargetFrom(formData);
  if (!target) redirect("/browse");
  const path = composerPath(target);
  const account = await requireAccount(path);
  const subject = await composerSubject(target);
  if (!subject) redirect("/browse");
  // The page says why these can't be messaged (spec 3.1); a post that arrives anyway just goes back to it.
  if (!subject.open || subject.seller.slug === shopSlugOf(account)) back(path);
  const now = new Date();
  const form = composerFormKey(target);
  const message = checkMessage(text(formData, "body"));
  const swap = subject.swaps ? checkSwapOffer(text(formData, "swapOffer")) : { value: "", error: null };
  const values = { body: keepTyped(message.value), swapOffer: keepTyped(swap.value) };
  const errors = [message.error, swap.error].filter((error) => error !== null);
  if (errors.length > 0) {
    await writeFormState(form, { errors, values, notice: null }, now);
    back(path);
  }
  const warnings = text(formData, "anyway") === "yes" ? [] : scamWarnings(`${message.value}\n${swap.value}`);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { ...values, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  const { conversationId } = await startConversation({
    buyerId: account.id,
    listing: subject.listing ? { id: subject.listing.id, title: subject.listing.title } : null,
    sellerSlug: subject.seller.slug,
    body: message.value,
    swapOffer: swap.value || null,
    now,
  });
  await clearOwnFormState(form);
  await writeFormState(sentNoteKey(conversationId), { errors: [], values: {}, notice: "sent" }, now);
  done(threadPath(conversationId));
}

/** A reply in a thread (spec 3.3), checked like a first message (plan decision 9). */
export async function sendReply(formData: FormData): Promise<void> {
  const id = idFrom(formData, "conversation");
  if (!id) redirect("/messages");
  const path = threadPath(id);
  const account = await requireAccount(path);
  const now = new Date();
  const form = replyFormKey(id);
  const message = checkMessage(text(formData, "body"));
  const body = keepTyped(message.value);
  if (message.error) {
    await writeFormState(form, { errors: [message.error], values: { body }, notice: null }, now);
    back(path);
  }
  const warnings = text(formData, "anyway") === "yes" ? [] : scamWarnings(message.value);
  if (warnings.length > 0) {
    await writeFormState(form, { errors: [], values: { body, warnings: warnings.join(",") }, notice: "check" }, now);
    back(path);
  }
  const result = await sendMessage({ conversationId: id, accountId: account.id, body: message.value, now });
  if (result === "not-found") back("/messages");
  await clearOwnFormState(form);
  // "closed" sends nothing: the thread says the other side has left (plan decision 21). Nor does "hub-paused": the
  // seller's thread says the Hub has paused the shop (decisions log row 74).
  done(path);
}

// --- The sale (spec 2.5) ------------------------------------------------------------------------------------------------

type SaleChange = (change: { conversationId: string; accountId: string; now: Date }) => Promise<unknown>;

/** One of the sale's buttons. A press the rules don't allow (plan decision 30) changes nothing. */
async function changeSale(formData: FormData, change: SaleChange): Promise<void> {
  const id = idFrom(formData, "conversation");
  if (!id) redirect("/messages");
  const account = await requireAccount(threadPath(id));
  await change({ conversationId: id, accountId: account.id, now: new Date() });
  done(threadPath(id));
}

/** The seller's Mark as completed. */
export async function markAsCompleted(formData: FormData): Promise<void> {
  await changeSale(formData, markCompleted);
}

/** The buyer's Confirm the sale. */
export async function confirmTheSale(formData: FormData): Promise<void> {
  await changeSale(formData, confirmSale);
}

/** The buyer's It didn't happen. */
export async function saleDidntHappen(formData: FormData): Promise<void> {
  await changeSale(formData, rejectSale);
}

// --- Reports (spec 2.8 and 3.4) ---------------------------------------------------------------------------------------

function reportTargetFrom(formData: FormData): ReportTarget | null {
  const kind = text(formData, "kind");
  const id = idFrom(formData, "id");
  if (!id || (kind !== "listing" && kind !== "seller" && kind !== "request")) return null;
  return { kind, id };
}

/**
 * Send report (spec 3.4): one of the seven reasons and an optional detail, at most 10 a day. A second report on a
 * target the account has already reported, while that report is open, goes straight to the thank-you and stores
 * nothing (plan decision 17).
 */
export async function sendReport(formData: FormData): Promise<void> {
  const target = reportTargetFrom(formData);
  if (!target) redirect("/");
  const path = reportPath(target);
  const account = await requireAccount(path);
  const subject = await reportSubject(target);
  if (!subject) redirect("/");
  if (await hasOpenReport(account.id, target)) done(reportSentPath(target));
  const now = new Date();
  const form = reportFormKey(target);
  const reason = parseReason(text(formData, "reason"));
  const detail = checkReportDetail(text(formData, "detail"));
  const errors: string[] = [];
  if (!reason) errors.push("reason-missing");
  if (detail.error) errors.push(detail.error);
  const since = new Date(now.getTime() - DAY_MS);
  if (errors.length === 0 && (await countReportsSince(account.id, since)) >= REPORTS_PER_DAY) errors.push("report-rate");
  if (errors.length > 0 || !reason) {
    const values = { reason: reason ?? "", detail: keepTyped(detail.value) };
    await writeFormState(form, { errors, values, notice: null }, now);
    back(path);
  }
  await createReport({ reporterId: account.id, target, targetTitle: subject.title, reason, detail: detail.value, now });
  await clearOwnFormState(form);
  done(reportSentPath(target));
}
