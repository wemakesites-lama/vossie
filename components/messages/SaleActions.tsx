import { confirmTheSale, markAsCompleted, saleDidntHappen } from "@/lib/messaging/actions";
import { autoConfirmAt } from "@/lib/messaging/rules";
import { shortSastDate } from "@/lib/time";
import type { Thread } from "@/lib/types";

/** The conversation's id, for the sale's forms. The action checks it against the session (plan decision 30). */
function ConversationField({ id }: { id: string }) {
  return <input type="hidden" name="conversation" value={id} />;
}

/**
 * The sale (messaging spec 2.5, plan decision 30): the seller's Mark as completed once they've replied (not when the
 * buyer has left, plan amendment 3); the buyer's Confirm the sale and It didn't happen once it's done; and lines saying
 * where it stands. Every press is a plain form.
 */
export function SaleActions({ thread }: { thread: Thread }) {
  const { id, role, status, otherName, otherPresent, completedAt, confirmedAt, confirmedBy } = thread;
  if (status === "confirmed" && confirmedAt) {
    const line =
      confirmedBy === "auto"
        ? `Sale confirmed automatically on ${shortSastDate(confirmedAt)}, a week after it was marked completed.`
        : `Sale confirmed on ${shortSastDate(confirmedAt)}.`;
    return <p className="thread-sale">{line}</p>;
  }
  if (status === "done" && completedAt) {
    const marked = shortSastDate(completedAt);
    const auto = shortSastDate(autoConfirmAt(completedAt));
    if (role === "seller") {
      return (
        <p className="thread-sale">
          {`You marked this as completed on ${marked}. ${otherName} is asked to confirm it; if they don't answer, it confirms itself on ${auto}.`}
        </p>
      );
    }
    return (
      <section aria-labelledby="thread-sale-title" className="thread-sale thread-sale-ask">
        <h2 id="thread-sale-title" className="thread-sale-title">
          Did the sale happen?
        </h2>
        <p>{`${otherName} marked this as completed on ${marked}. If you don't answer, it confirms itself on ${auto}.`}</p>
        <div className="thread-sale-buttons">
          <form action={confirmTheSale}>
            <ConversationField id={id} />
            <button type="submit" className="btn btn-primary">
              Confirm the sale
            </button>
          </form>
          <form action={saleDidntHappen}>
            <ConversationField id={id} />
            <button type="submit" className="btn btn-outline text-navy">
              It didn&apos;t happen
            </button>
          </form>
        </div>
      </section>
    );
  }
  if (status === "replied" && role === "seller" && otherPresent) {
    return (
      <form action={markAsCompleted} className="thread-sale thread-sale-mark">
        <ConversationField id={id} />
        <button type="submit" className="btn btn-outline text-navy">
          Mark as completed
        </button>
        <p className="form-hint">{`When the sale or swap has happened. ${otherName} is then asked to confirm it.`}</p>
      </form>
    );
  }
  return null;
}
