import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { AdminSeller } from "@/components/staff/AdminSeller";
import { NextInQueue } from "@/components/staff/NextInQueue";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses, getCategories } from "@/lib/data";
import { listPickupPoints } from "@/lib/data/pickup-points";
import { countAdmins } from "@/lib/data/staff-accounts";
import { getShopForReview, listMentors, listShopsForReview, ownsShop } from "@/lib/data/staff-shops";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { adminSellerPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { nextWaitingShop } from "@/lib/staff/queue";
import { PageTransition } from "@/components/kit/PageTransition";

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
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <SellerReview params={params} />
      </Reveal>
    </PageTransition>
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
  const own = await ownsShop(account.id, slug);
  const [campuses, categories, points, mentors, notice, admins, shops] = await Promise.all([
    getCampuses(),
    getCategories(),
    // Every point, retired ones too, on either backend (C4/C5 plan Task 17).
    listPickupPoints(),
    listMentors(review.shop.ownerId),
    takeNotice(),
    own ? countAdmins() : Promise.resolve(0),
    // For the Next link (role views spec 7.2): the oldest waiting shop that isn't this one.
    listShopsForReview(),
  ]);
  const next = nextWaitingShop(shops, slug);
  return (
    <StaffFrame
      account={account}
      area={STAFF_EYEBROW.admin}
      title={review.shop.name}
      route="/admin/sellers/[slug]"
      notice={staffNoticeText(notice)}
    >
      <NextInQueue
        label="Next waiting shop"
        next={next && { title: next.shop.name, href: adminSellerPath(next.shop.slug) }}
        none="No other shop is waiting."
      />
      <AdminSeller
        review={review}
        campusName={campuses.find((campus) => campus.slug === review.shop.campusSlug)?.name ?? ""}
        categoryName={categories.find((category) => category.slug === review.shop.categorySlug)?.name ?? ""}
        pointNames={review.shop.pickupPointIds.flatMap((id) => points.find((point) => point.id === id)?.name ?? [])}
        mentors={mentors}
        own={own}
        onlyAdmin={own && admins === 1}
      />
    </StaffFrame>
  );
}
