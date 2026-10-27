import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { SellerConfirm } from "@/components/staff/SellerConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { countAdmins } from "@/lib/data/staff-accounts";
import { getShopForReview, ownsShop } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { declineForm } from "@/lib/staff/form-state";
import { declineSellerPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Decline a shop");
}

export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** Decline's confirm page (staff tools spec 2.9, plan decision 18). */
export default function DeclineSellerPage({ params }: PageProps<"/admin/sellers/[slug]/decline">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Decline params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Decline({ params }: Pick<PageProps<"/admin/sellers/[slug]/decline">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("admin", declineSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  const own = await ownsShop(account.id, slug);
  const [state, admins] = await Promise.all([
    readFormState(declineForm(slug)),
    own ? countAdmins() : Promise.resolve(0),
  ]);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={`Decline ${review.shop.name}`} route="/admin/sellers/[slug]/decline"
      trail={{ params: { slug }, names: { "/admin/sellers/[slug]": review.shop.name } }} notice={null}>
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
