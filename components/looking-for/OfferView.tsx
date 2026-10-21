import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { ArrowLeftIcon } from "@/components/icons";
import { MessageField } from "@/components/messages/MessageField";
import { SafetyTips } from "@/components/messages/SafetyTips";
import { ScamCheck } from "@/components/messages/ScamCheck";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { budgetLabel, dayMonth } from "@/lib/format";
import { sendOffer } from "@/lib/looking-for/actions";
import { offerErrors, offerFieldIds } from "@/lib/looking-for/errors";
import { offerFieldPrefix, requestPath } from "@/lib/looking-for/paths";
import type { OfferStatus, OfferSubject } from "@/lib/looking-for/subjects";
import { threadPath } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import type { LookingForRequest } from "@/lib/types";

/** The composer's fields after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type OfferForm = { body: string; listing: string; errors: FormError[]; warnings: ScamWarning[] };

export function offerForm(state: FormStateRow | null, prefix: string): OfferForm {
  if (!state) return { body: "", listing: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    listing: state.values.listing ?? "",
    errors: offerErrors(state.errors, offerFieldIds(prefix)),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

/** A note instead of the form, with the way on when there is one (plan decision 12). */
function Note({ sentence, link }: { sentence: string; link?: { href: string; label: string; primary?: boolean } }) {
  return (
    <div className="offer-note">
      <p className="form-notice">{sentence}</p>
      {link && (
        <Link href={link.href} prefetch={false} className={link.primary ? "btn btn-primary" : "btn btn-outline text-navy"}>
          {link.label}
        </Link>
      )}
    </div>
  );
}

/** What the offer answers (spec 2.9): the title, campus, budget and needed by. The asker isn't named. */
function RequestSummary({ request, campusName }: { request: LookingForRequest; campusName: string }) {
  return (
    <div className="offer-summary">
      <p className="offer-summary-eyebrow">Looking For</p>
      <p className="offer-summary-title">{request.title}</p>
      <ul className="fact-pills">
        <li>{campusName}</li>
        <li>{budgetLabel(request)}</li>
        {request.neededBy && (
          <li>
            Needed by <time dateTime={request.neededBy}>{dayMonth(request.neededBy)}</time>
          </li>
        )}
      </ul>
    </div>
  );
}

type OfferViewProps = { subject: OfferSubject; status: OfferStatus; form: OfferForm };

/**
 * The offer composer (community actions spec 2.9): the request, "Offer to help", the form or why there's none, and
 * E's three tips. Laid out like E's composer, with its classes. Its ids start "offer-<id>" (plan decision 2).
 */
export function OfferView({ subject, status, form }: OfferViewProps) {
  const { request, campusName } = subject;
  let main: ReactNode;
  switch (status.kind) {
    case "open":
      main = <OfferFormView request={request} listings={status.listings} form={form} />;
      break;
    case "no-shop":
      main = (
        <Note
          sentence="Offers come from shops on CampusCart, so the Hub has checked who's offering."
          link={{ href: "/sell", label: "Start selling", primary: true }}
        />
      );
      break;
    case "pending":
      main = (
        <Note sentence="Your shop can make offers once the Hub approves it." link={{ href: "/sell", label: "Go to your shop" }} />
      );
      break;
    case "paused":
      main = (
        <Note sentence="Your shop is paused, so it can't make offers right now." link={{ href: "/sell", label: "Go to your shop" }} />
      );
      break;
    case "own":
      main = <Note sentence="This is your request, so you can't offer on it." />;
      break;
    case "closed":
      main = <Note sentence="This request is closed, so it isn't taking offers." />;
      break;
    case "sample":
      main = <Note sentence="This is one of CampusCart's sample requests, so it can't take offers." />;
      break;
    case "offered":
      main = (
        <Note
          sentence="You've offered already."
          link={{ href: threadPath(status.conversationId), label: "Open the conversation", primary: true }}
        />
      );
      break;
  }
  return (
    <>
      <Link href={requestPath(request.id)} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to the request
      </Link>
      <h1 className="composer-title">Offer to help</h1>
      <div className="composer-layout">
        <div className="composer-main">
          <RequestSummary request={request} campusName={campusName} />
          {main}
        </div>
        <SafetyTips id={`${offerFieldPrefix(request.id)}-tips`} />
      </div>
    </>
  );
}

type OfferFormViewProps = {
  request: LookingForRequest;
  listings: readonly { id: string; title: string }[];
  form: OfferForm;
};

/** The form itself: the offer, a listing to point to when the shop has any (plan decision 13), the check, Send offer. */
function OfferFormView({ request, listings, form }: OfferFormViewProps) {
  const prefix = offerFieldPrefix(request.id);
  const ids = offerFieldIds(prefix);
  const listingHint = `${ids.listing}-hint`;
  return (
    <>
      <ErrorSummary id={`${prefix}-summary`} errors={form.errors} />
      <form action={sendOffer} noValidate className="form-stack composer-form">
        <input type="hidden" name="request" value={request.id} />
        <MessageField
          id={ids.body}
          name="body"
          label="Your offer"
          hint="Up to 1,000 characters. Say how you can help, what it costs and when."
          defaultValue={form.body}
          error={errorFor(form.errors, ids.body)}
          rows={6}
          required
        />
        {listings.length > 0 && (
          <div className="form-field">
            <label htmlFor={ids.listing} className="form-label">
              Point to one of your listings (optional)
            </label>
            <p id={listingHint} className="form-hint">
              The student sees it in your conversation.
            </p>
            <select
              id={ids.listing}
              name="listing"
              defaultValue={form.listing}
              aria-describedby={listingHint}
              className="form-input form-select"
            >
              <option value="">None</option>
              {listings.map((listing) => (
                <option key={listing.id} value={listing.id}>
                  {listing.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn btn-primary form-submit">
          Send offer
        </button>
        <ScamCheck warnings={form.warnings} idPrefix={prefix} />
      </form>
    </>
  );
}
