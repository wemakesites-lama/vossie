import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { ReportView } from "@/lib/data/staff-reports";
import { hideReportedListing, pauseReportedShop } from "@/lib/staff/admin-actions";
import { adminReportPath } from "@/lib/staff/paths";
import { ConfirmAction } from "./ConfirmAction";

type ReportConfirmProps = {
  kind: "hide" | "pause";
  report: ReportView;
  reason: string;
  errors: readonly FormError[];
};

/**
 * Hide the listing's and Pause the account's confirm pages (spec 2.9; plan decisions 4, 5 and 18): what will happen,
 * the reason, and the button. When the report doesn't allow it (closed, about a request, gone), a sentence and the way
 * back. The words are samples for Lama to change.
 */
export function ReportConfirm({ kind, report, reason, errors }: ReportConfirmProps) {
  const back = adminReportPath(report.id);
  const shop = report.shop;
  // This branch is the listing's: stage H adds its own for a Looking For request (amendment 7).
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
        ? "This listing can't be hidden from this report: it's closed, hidden already, or gone."
        : "The shop can't be paused from this report: it's closed, a sample shop, or paused by the Hub already."}{" "}
      <Link href={back} prefetch={false}>
        Back to the report
      </Link>
    </p>
  );
}
