import { statusLabel } from "@/lib/messaging/rules";
import type { ConversationStatus } from "@/lib/types";

/** A conversation's status, in words (messaging spec 2.5 and section 5); the colour only backs them up. */
export function StatusPill({ status }: { status: ConversationStatus }) {
  return (
    <span className="status-pill" data-status={status}>
      {statusLabel(status)}
    </span>
  );
}
