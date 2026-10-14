import Link from "next/link";
import { ErrorSummary } from "@/components/forms/ErrorSummary";
import { ArrowLeftIcon } from "@/components/icons";
import { errorFor, type FormError } from "@/lib/auth/messages";
import type { FormStateRow } from "@/lib/data/rows";
import { sendReply } from "@/lib/messaging/actions";
import { messagingErrors, replyFields } from "@/lib/messaging/errors";
import { inboxPath, threadPath } from "@/lib/messaging/paths";
import { parseWarnings, type ScamWarning } from "@/lib/messaging/scam-check";
import { messageTime } from "@/lib/time";
import type { Thread } from "@/lib/types";
import { MessageField } from "./MessageField";
import { MessageSummary } from "./MessageSummary";
import { SaleActions } from "./SaleActions";
import { ScamCheck } from "./ScamCheck";
import { StatusPill } from "./StatusPill";

/** The reply form after a post (D decision 3): what was typed, what's wrong, and the scam check's warnings. */
export type ReplyForm = { body: string; errors: FormError[]; warnings: ScamWarning[] };

/** `conversationId` is the thread the form is for: its field id ends with it (plan amendment 5). */
export function replyForm(state: FormStateRow | null, conversationId: string): ReplyForm {
  if (!state) return { body: "", errors: [], warnings: [] };
  return {
    body: state.values.body ?? "",
    errors: messagingErrors(state.errors, replyFields(conversationId)),
    warnings: state.notice === "check" ? parseWarnings(state.values.warnings) : [],
  };
}

type ThreadViewProps = {
  thread: Thread;
  /** Read after `await connection()`, for the times (plan decision 28). */
  now: Date;
  reply: ReplyForm;
  /** The composer has just sent the first message (plan decision 7). */
  sent: boolean;
  campusName: string;
};

/**
 * A thread (messaging spec 3.3): who it's with, Refresh, the listing and its status, the messages, the sale, and the
 * reply form. Each message says who wrote it and when in words, so it isn't read by colour or side alone (section 5).
 * Message text is React text: no markup, and addresses aren't made into links (spec 2.12).
 */
export function ThreadView({ thread, now, reply, sent, campusName }: ThreadViewProps) {
  return (
    <div className="thread-column">
      <Link href={inboxPath(thread.role === "seller" ? "selling" : "buying")} prefetch={false} className="msg-crumb">
        <ArrowLeftIcon />
        Back to messages
      </Link>
      <div className="thread-head">
        <h1 className="thread-title">
          {/* The space sits outside the sr-only span: name computation trims each element's own text. */}
          <span className="sr-only">Messages with</span> {thread.otherName}
        </h1>
        {/* A full page load: the one way to be sure the other side's new messages show (plan decision 19). */}
        <a href={threadPath(thread.id)} className="msg-refresh">
          Refresh
        </a>
      </div>
      <MessageSummary
        listing={thread.listing}
        listingTitle={thread.listingTitle}
        shop={thread.shop}
        campusName={campusName}
      >
        <StatusPill status={thread.status} />
      </MessageSummary>
      {sent && (
        <p role="status" className="form-notice">
          Sent. Sellers usually reply within a day.
        </p>
      )}
      <section aria-labelledby="thread-messages-title">
        <h2 id="thread-messages-title" className="sr-only">
          Messages
        </h2>
        <ol className="thread-list">
          {thread.messages.map((message) => (
            <li key={message.id} className="thread-message" data-from={message.fromViewer ? "you" : "them"}>
              <p className="thread-meta">
                <span className="thread-author">{message.author}</span>
                <span aria-hidden="true"> · </span>
                <span className="sr-only">, </span>
                <time dateTime={message.sentAt}>{messageTime(message.sentAt, now)}</time>
              </p>
              <p className="thread-text">{message.body}</p>
              {message.swapOffer && (
                <p className="thread-swap">
                  <strong>Swap offer:</strong> {message.swapOffer}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
      <SaleActions thread={thread} />
      {thread.otherPresent ? (
        <ReplyFormView thread={thread} reply={reply} />
      ) : (
        <p className="form-notice">This person has left Vossie, so you can&apos;t reply.</p>
      )}
    </div>
  );
}

function ReplyFormView({ thread, reply }: { thread: Thread; reply: ReplyForm }) {
  const fields = replyFields(thread.id);
  return (
    <section aria-labelledby="thread-reply-title" className="thread-reply">
      <h2 id="thread-reply-title" className="sr-only">
        Reply
      </h2>
      <ErrorSummary id="thread-reply-summary" errors={reply.errors} />
      {/* A new form after each message: Activity would otherwise keep the text just sent (plan decision 20). */}
      <form key={thread.messages.length} action={sendReply} noValidate className="form-stack">
        <input type="hidden" name="conversation" value={thread.id} />
        <MessageField
          id={fields.body}
          name="body"
          label="Your reply"
          hint="Up to 1,000 characters."
          defaultValue={reply.body}
          error={errorFor(reply.errors, fields.body)}
          rows={4}
          required
        />
        <button type="submit" className="btn btn-primary form-submit">
          Send
        </button>
        <ScamCheck warnings={reply.warnings} idPrefix="thread" />
      </form>
    </section>
  );
}
