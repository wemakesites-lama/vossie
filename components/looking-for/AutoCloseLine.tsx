import { dayMonth } from "@/lib/format";
import { AUTO_CLOSE_WHY } from "@/lib/looking-for/words";
import { shortSastDate } from "@/lib/time";
import type { OwnRequest } from "@/lib/types";

/**
 * For the asker only (stage L spec section 4): when their open request closes by itself, or that a closed one did,
 * when, and why, in the style of the line it sits under (`className`). Nothing for a request its asker closed, a
 * hidden one, or one with no closing day. The words are samples for Lama to change.
 */
export function AutoCloseLine({ own, className }: { own: OwnRequest; className: string }) {
  const { request, state } = own;
  if (state === "open" && request.closesOn) {
    return (
      <p className={className}>
        Closes automatically on <time dateTime={request.closesOn}>{dayMonth(request.closesOn)}</time>.
      </p>
    );
  }
  if (state === "closed" && own.closedAutomatically && own.closedAt && own.closeReason) {
    return (
      <p className={className}>
        Closed automatically on <time dateTime={own.closedAt}>{shortSastDate(own.closedAt)}</time>,{" "}
        {AUTO_CLOSE_WHY[own.closeReason]}.
      </p>
    );
  }
  return null;
}
