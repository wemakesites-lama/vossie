import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { countAdmins } from "@/lib/data/staff-accounts";
import { getShopForReview, ownsShop } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { shopPauseForm } from "@/lib/staff/form-state";
import { ADMIN_SELLERS_PATH, pauseSellerPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pause a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Pause shop's confirm page (staff tools spec 2.9, plan decisions 3 and 18). */
export default function PauseSellerPage({ params }: PageProps<"/admin/sellers/[slug]/pause">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Pause params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Pause({ params }: Pick<PageProps<"/admin/sellers/[slug]/pause">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("admin", pauseSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const own = await ownsShop(account.id, slug);
  const [state, admins] = await Promise.all([
    readFormState(shopPauseForm(slug)),
    own ? countAdmins() : Promise.resolve(0),
  ]);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={`Pause ${review.shop.name}`} current={ADMIN_SELLERS_PATH} notice={null}>
      <SellerConfirm
        kind="pause"
        review={review}
        own={own}
        onlyAdmin={own && admins === 1}
        reason={state?.values.reason ?? ""}
        errors={staffErrors(state?.errors ?? [], staffFieldIds(`pause-${slug}`))}
      />
    </StaffFrame>
  );
}
