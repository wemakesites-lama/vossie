import Link from "next/link";
import type { ReactNode } from "react";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendFirstMessage } from "@/lib/messaging/actions";
import { composerFields, messagingErrors } from "@/lib/messaging/errors";
import { threadPath, type MessageTarget } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import type { ComposerSubject } from "@/lib/messaging/subjects";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SafetyTips } from "./SafetyTips";
import { ScamCheck } from "./ScamCheck";
import { Trail } from "@/components/ui/Trail";
import { trailFor } from "@/lib/nav/trail";

/** The composer's fields after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type ComposerForm = { body: string; swapOffer: string; errors: FormError[]; warnings: ScamWarning[] };

/** `target` is the listing or shop the form is for: its field ids end with it (plan amendment 5). */
export function composerForm(state: FormStateRow | null, target: MessageTarget): ComposerForm {
  if (!state) return { body: "", swapOffer: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    swapOffer: state.values.swapOffer ?? "",
    errors: messagingErrors(state.errors, composerFields(target)),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

/** Whether the visitor can write here (spec 3.1, plan decision 5). */
export type ComposerStatus =
  | { kind: "open" }
  | { kind: "own" }
  | { kind: "unavailable" }
  | { kind: "existing"; conversationId: string };

type ComposerViewProps = {
  subject: ComposerSubject;
  status: ComposerStatus;
  form: ComposerForm;
};

/** The composer (messaging spec 3.1): the listing or shop, "Message {shop}", the form or why there's none, the tips. */
export function ComposerView({ subject, status, form }: ComposerViewProps) {
  const { listing, seller, campusName, target } = subject;
  // The tips' heading id ends with the listing or shop, like the fields' ids, so two kept composers never share one
  // (messaging plan amendment 5; community actions plan amendment 19.9).
  const item = target.kind === "listing" ? target.listingId : target.sellerSlug;
  const here = `Message ${seller.name}`;
  const crumbs = listing
    ? trailFor("/listings/[id]/message", {
        params: { id: listing.id },
        names: { "/listings/[id]": listing.title, "/listings/[id]/message": here },
      })
    : trailFor("/sellers/[slug]/message", {
        params: { slug: seller.slug },
        names: { "/sellers/[slug]": seller.name, "/sellers/[slug]/message": here },
      });
  let main: ReactNode = null;
  switch (status.kind) {
    case "own":
      main = (
        <p className="form-notice">{`This is your ${listing ? "listing" : "shop"}, so you can't message yourself.`}</p>
      );
      break;
    case "unavailable":
      main = (
        <div className="composer-note">
          <p className="form-notice">This listing isn&apos;t available right now, so it can&apos;t be messaged.</p>
          {listing && (
            <Link href={`/browse?cat=${listing.categorySlug}`} prefetch={false} className="btn btn-outline text-navy">
              See similar items
            </Link>
          )}
        </div>
      );
      break;
    case "existing":
      main = (
        <div className="composer-note">
          <p className="form-notice">
            {listing
              ? `You've already messaged ${seller.name} about this.`
              : `You already have a conversation with ${seller.name}.`}
          </p>
          <Link href={threadPath(status.conversationId)} prefetch={false} className="btn btn-primary">
            Open the conversation
          </Link>
        </div>
      );
      break;
    case "open":
      main = <ComposerForm subject={subject} form={form} />;
      break;
  }
  return (
    <>
      <Trail crumbs={crumbs} />
      <h1 className="composer-title">{`Message ${seller.name}`}</h1>
      <div className="composer-layout">
        <div className="composer-main">
          <MessageSummary listing={listing} listingTitle={null} shop={seller} campusName={campusName} />
          {main}
        </div>
        <SafetyTips id={`composer-${item}-tips`} />
      </div>
    </>
  );
}

/** The form itself: the message, the swap offer when the listing takes swaps (spec 2.4), the check, and Send. */
function ComposerForm({ subject, form }: { subject: ComposerSubject; form: ComposerForm }) {
  const { target, listing, seller, swaps } = subject;
  const fields = composerFields(target);
  const swapHint = listing?.swapFor
    ? `${seller.name} would swap for ${listing.swapFor}. Up to 200 characters.`
    : "Say what you'd swap. Up to 200 characters.";
  return (
    <>
      <ErrorSummary id="composer-summary" errors={form.errors} />
      <form action={sendFirstMessage} noValidate className="form-stack composer-form">
        {target.kind === "listing" ? (
          <input type="hidden" name="listing" value={target.listingId} />
        ) : (
          <input type="hidden" name="shop" value={target.sellerSlug} />
        )}
        <MessageField
          id={fields.body}
          name="body"
          label="Your message"
          hint="Up to 1,000 characters. Ask what you need to know, and say when you could meet."
          defaultValue={form.body}
          error={errorFor(form.errors, fields.body)}
          rows={6}
          required
        />
        {swaps && (
          <MessageField
            id={fields.swapOffer}
            name="swapOffer"
            label="Offer a swap (optional)"
            hint={swapHint}
            defaultValue={form.swapOffer}
            error={errorFor(form.errors, fields.swapOffer)}
            rows={2}
          />
        )}
        <button type="submit" className="btn btn-primary form-submit">
          Send
        </button>
        <ScamCheck warnings={form.warnings} idPrefix="composer" />
      </form>
    </>
  );
}
