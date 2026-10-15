import Link from "next/link";
import type { FormError } from "@/lib/auth/messages";
import type { ShopReview } from "@/lib/data/staff-shops";
import { declineSeller, pauseSeller } from "@/lib/staff/admin-actions";
import { adminSellerPath } from "@/lib/staff/paths";
import { ConfirmAction } from "./ConfirmAction";

type SellerConfirmProps = {
  kind: "decline" | "pause";
  review: ShopReview;
  /** What was typed before a failed post. */
  reason: string;
  errors: readonly FormError[];
};

/**
 * Decline's and Pause shop's confirm pages (spec 2.9, plan decision 18): what will happen, the reason, and the button.
 * A shop that can't be declined or paused now (already done, a sample shop) gets a sentence and the way back instead.
 * The words are samples for Lama to change.
 */
export function SellerConfirm({ kind, review, reason, errors }: SellerConfirmProps) {
  const { shop, owner, standing } = review;
  const back = adminSellerPath(shop.slug);
  const who = owner?.firstName ?? "The seller";
  const allowed =
    kind === "decline"
      ? standing === "waiting"
      : owner !== null && (standing === "open" || (standing === "paused" && review.pausedBy !== "staff"));
  if (!allowed) {
    return (
      <p>
        {kind === "decline"
          ? `${shop.name} isn't waiting for approval, so there's nothing to decline.`
          : `${shop.name} can't be paused now: the Hub has paused it already, it's still waiting, or it's a sample shop.`}{" "}
        <Link href={back} prefetch={false}>
          Back to {shop.name}
        </Link>
      </p>
    );
  }
  if (kind === "decline") {
    return (
      <ConfirmAction
        id={`decline-${shop.slug}`}
        lead={`Decline ${shop.name}? It won't be approved yet.`}
        consequences={[
          `${who} sees your reason on their selling page, and gets a notification.`,
          "The shop stays waiting: they can change it and send it again.",
          "Nothing is deleted.",
        ]}
        action={declineSeller}
        hidden={{ shop: shop.slug }}
        reasonHint="The seller sees it."
        reason={reason}
        errors={errors}
        confirmLabel={`Decline ${shop.name}`}
        keepHref={back}
      />
    );
  }
  return (
    <ConfirmAction
      id={`pause-${shop.slug}`}
      lead={`Pause ${shop.name}? Buyers stop seeing it straight away.`}
      consequences={[
        "The shop and its listings disappear for buyers: their pages show 'not found'.",
        `${who} sees your reason on their dashboard and gets a notification. Only the Hub can resume it.`,
        "Nothing is deleted.",
      ]}
      action={pauseSeller}
      hidden={{ shop: shop.slug }}
      reasonHint="The seller sees it."
      reason={reason}
      errors={errors}
      confirmLabel={`Pause ${shop.name}`}
      keepHref={back}
    />
  );
}
