import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminSeller } from "@/components/staff/AdminSeller";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses, getCategories } from "@/lib/data";
import { pickupPointName } from "@/lib/data/pickup-points";
import { countAdmins } from "@/lib/data/staff-accounts";
import { getShopForReview, isOwnShop, listMentors } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_SELLERS_PATH, adminSellerPath } from "@/lib/staff/paths";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Review a shop");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's review page (staff tools spec 2.3). An unknown shop is the 404. */
export default function AdminSellerPage({ params }: PageProps<"/admin/sellers/[slug]">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <SellerReview params={params} />
    </Suspense>
  );
}

async function SellerReview({ params }: Pick<PageProps<"/admin/sellers/[slug]">, "params">) {
  const { slug } = await params;
  // The role first, so someone without it gets the 404 whatever the address says (plan decision 1).
  const account = await requireStaff("admin", adminSellerPath(slug));
  const review = isId(slug) ? await getShopForReview(slug) : null;
  if (!review) notFound();
  // The admin's own shop shows why in place of its controls, and its owner is never offered as its mentor (stage L
  // spec decisions 4 to 6).
  const own = isOwnShop(account.id, slug);
  const [campuses, categories, mentors, notice, admins] = await Promise.all([
    getCampuses(),
    getCategories(),
    listMentors(review.shop.ownerId),
    takeNotice(),
    own ? countAdmins() : Promise.resolve(0),
  ]);
  return (
    <StaffFrame
      account={account}
      area="Admin console"
      title={review.shop.name}
      current={ADMIN_SELLERS_PATH}
      notice={staffNoticeText(notice)}
    >
      <AdminSeller
        review={review}
        campusName={campuses.find((campus) => campus.slug === review.shop.campusSlug)?.name ?? ""}
        categoryName={categories.find((category) => category.slug === review.shop.categorySlug)?.name ?? ""}
        pointNames={review.shop.pickupPointIds.flatMap((id) => pickupPointName(id) ?? [])}
        mentors={mentors}
        own={own}
        onlyAdmin={own && admins === 1}
      />
    </StaffFrame>
  );
}
