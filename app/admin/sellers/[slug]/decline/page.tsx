import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { countAdmins } from "@/lib/data/staff-accounts";
import { getShopForReview, isOwnShop } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { declineForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, declineSellerPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Decline a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Decline's confirm page (staff tools spec 2.9, plan decision 18). */
export default function DeclineSellerPage({ params }: PageProps<"/admin/sellers/[slug]/decline">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Decline params={params} />
    </Suspense>
  );
}

async function Decline({ params }: Pick<PageProps<"/admin/sellers/[slug]/decline">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("admin", declineSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const own = isOwnShop(account.id, slug);
  const [state, admins] = await Promise.all([
    readFormState(declineForm(slug)),
    own ? countAdmins() : Promise.resolve(0),
  ]);
  return (
    <StaffFrame account={account} area="Admin console" title={`Decline ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="decline"
        review={review}
        own={own}
        onlyAdmin={own && admins === 1}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`decline-${slug}`))}
      />
    </StaffFrame>
  );
}
