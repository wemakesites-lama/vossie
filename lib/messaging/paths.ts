import type { InboxTab, ReportTarget } from "@/lib/types";

// Messaging's addresses (messaging spec 2.1, 2.8 and section 3), the sign-in page's back link (plan decision 4), and
// the keys its forms keep their state under (D decision 3).

/** Who a first message goes to: a listing's seller (spec 2.1), or a shop, with a question (plan decision 2). */
export type MessageTarget = { kind: "listing"; listingId: string } | { kind: "shop"; sellerSlug: string };

/** Ids and slugs as this site makes them: lower case letters, digits and hyphens. Anything else from a form is refused. */
const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isId(value: string): boolean {
  return ID.test(value);
}

export function composerPath(target: MessageTarget): string {
  return target.kind === "listing" ? `/listings/${target.listingId}/message` : `/sellers/${target.sellerSlug}/message`;
}

export function threadPath(conversationId: string): string {
  return `/messages/${conversationId}`;
}

export function inboxPath(tab: InboxTab): string {
  return tab === "selling" ? "/messages?tab=selling" : "/messages";
}

/** "?tab=selling" opens Selling; anything else is Buying (spec 2.10). */
export function parseInboxTab(raw: string | string[] | undefined): InboxTab {
  return (Array.isArray(raw) ? raw[0] : raw) === "selling" ? "selling" : "buying";
}

const REPORT_KINDS: ReadonlyArray<ReportTarget["kind"]> = ["listing", "seller", "request"];

/** The report form (spec 2.8): "/report?listing=l-001". */
export function reportPath(target: ReportTarget): string {
  return `/report?${target.kind}=${target.id}`;
}

/** The report's thank-you (plan decision 17). */
export function reportSentPath(target: ReportTarget): string {
  return `/report/sent?${target.kind}=${target.id}`;
}

/** The public page a reported thing lives on. */
export function targetPath(target: ReportTarget): string {
  if (target.kind === "listing") return `/listings/${target.id}`;
  if (target.kind === "seller") return `/sellers/${target.id}`;
  return `/looking-for/${target.id}`;
}

/** The report's target from an address's search params: exactly one of listing, seller or request, with a good id. */
export function parseReportTarget(params: Readonly<Record<string, string | string[] | undefined>>): ReportTarget | null {
  const found = REPORT_KINDS.flatMap((kind) => {
    const raw = params[kind];
    const id = Array.isArray(raw) ? raw[0] : raw;
    return id === undefined ? [] : [{ kind, id }];
  });
  return found.length === 1 && isId(found[0].id) ? found[0] : null;
}

const ACCOUNT_ONLY = ["/account", "/messages", "/notifications"];
const COMPOSER = /^\/(listings|sellers)\/([a-z0-9][a-z0-9-]*)\/message$/;

/**
 * Where the sign-in page's back link goes for `next` (plan decision 4): the listing, shop or request behind a composer
 * or a report form; nowhere for pages that need an account, since going back would only come back to sign-in; and
 * `next` itself otherwise. `next` has already been through safeNextPath.
 */
export function backPathFor(next: string): string | null {
  const url = new URL(next, "https://vossie.invalid");
  const path = url.pathname;
  if (ACCOUNT_ONLY.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  const composer = COMPOSER.exec(path);
  if (composer) return `/${composer[1]}/${composer[2]}`;
  if (path === "/report" || path === "/report/sent") {
    const target = parseReportTarget(Object.fromEntries(url.searchParams));
    return target ? targetPath(target) : null;
  }
  return next;
}

// Form-state keys (D decision 3): one per form and thing, so two drafts never mix.

export function composerFormKey(target: MessageTarget): string {
  return target.kind === "listing" ? `composer:listing:${target.listingId}` : `composer:shop:${target.sellerSlug}`;
}

export function replyFormKey(conversationId: string): string {
  return `reply:${conversationId}`;
}

/** Where the composer leaves "Sent." for the thread to take, once (plan decision 7). */
export function sentNoteKey(conversationId: string): string {
  return `sent:${conversationId}`;
}

export function reportFormKey(target: ReportTarget): string {
  return `report:${target.kind}:${target.id}`;
}
