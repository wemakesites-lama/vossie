import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { ReportView } from "@/lib/data/staff-reports";
import { hideReportedListing, hideReportedRequest, pauseReportedShop } from "@/lib/staff/admin-actions";
import { adminReportPath } from "@/lib/staff/paths";
import { ownReportLine } from "./AdminReport";
import { ConfirmAction } from "./ConfirmAction";

type ReportConfirmProps = {
  kind: "hide" | "pause";
  report: ReportView;
  reason: string;
  errors: readonly FormError[];
};

/**
 * Hide the listing's and Pause the account's confirm pages (spec 2.9; plan decisions 4, 5 and 18): what will happen,
 * the reason, and the button. A request's report hides the request (community actions plan decision 20). When the
 * report doesn't allow it (closed, hidden already, gone), a sentence and the way back. The words are samples for Lama
 * to change.
 */
export function ReportConfirm({ kind, report, reason, errors }: ReportConfirmProps) {
  const back = adminReportPath(report.id);
  const shop = report.shop;
  // The admin's own shop, listing or request (stage L spec section 3): the line and the way back, no form.
  if (report.own) {
    return (
      <p>
        {ownReportLine(report.own)}{" "}
        <Link href={back} prefetch={false}>
          Back to the report
        </Link>
      </p>
    );
  }
  // This branch is the listing's; the next is a Looking For request's (amendment 7).
  if (kind === "hide" && report.can.hide && report.target.kind === "listing") {
    return (
      <ConfirmAction
        id={`hide-${report.id}`}
        lead={`Hide ${report.targetTitle}? Buyers stop seeing it straight away.`}
        consequences={[
          "It leaves every list, and its page says it can't be found. Its seller still sees it in My listings, marked hidden, with your reason.",
          "Every open report about it closes, and each reporter hears that the Hub acted.",
          "It can't be shown again from here yet: the seller can still edit or delete it.",
        ]}
        action={hideReportedListing}
        hidden={{ report: report.id }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Hide ${report.targetTitle}`}
        keepHref={back}
      />
    );
  }
  if (kind === "hide" && report.can.hide && report.target.kind === "request") {
    return (
      <ConfirmAction
        id={`hide-${report.id}`}
        lead={`Hide ${report.targetTitle}? Students stop seeing it straight away.`}
        consequences={[
          "It leaves the board and the homepage, and its page says it can't be found. Shops can't offer on it.",
          "Every open report about it closes, and each reporter hears that the Hub acted.",
          "Its asker gets a notification and sees your reason in Your requests. They can delete it, but not edit or reopen it.",
          "It can't be shown again from here yet.",
        ]}
        action={hideReportedRequest}
        hidden={{ report: report.id }}
        reasonHint="The asker sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Hide ${report.targetTitle}`}
        keepHref={back}
      />
    );
  }
  if (kind === "pause" && report.can.pause && shop) {
    return (
      <ConfirmAction
        id={`report-pause-${report.id}`}
        lead={`Pause ${shop.name}? Buyers stop seeing it straight away.`}
        consequences={[
          "The shop and its listings disappear for buyers: their pages show 'not found'.",
          "Every open report about the shop or its listings closes, and each reporter hears that the Hub acted.",
          "The seller sees your reason on their dashboard and gets a notification. Only the Hub can resume it.",
        ]}
        action={pauseReportedShop}
        hidden={{ report: report.id }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Pause ${shop.name}`}
        keepHref={back}
      />
    );
  }
  return (
    <p>
      {kind === "hide"
        ? "It can't be hidden from this report: it's closed, hidden already, or gone."
        : "The shop can't be paused from this report: it's closed, a sample shop, or paused by the Hub already."}{" "}
      <Link href={back} prefetch={false}>
        Back to the report
      </Link>
    </p>
  );
}
