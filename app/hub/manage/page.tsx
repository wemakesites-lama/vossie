import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { HubManage } from "@/components/staff/HubManage";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getCampuses } from "@/lib/data";
import { canEditPost, listBookings, listPostsForStaff } from "@/lib/data/hub-posts";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { HUB_MANAGE_PATH, hubEyebrow } from "@/lib/staff/paths";
import { isAdmin } from "@/lib/staff/roles";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("hub", "Posts and office hours");
}

/** The Hub's tools (staff tools spec 3): posts and the office-hours queue. Mentors and admins only. */
export default function HubManagePage() {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Manage />
      </Reveal>
    </PageTransition>
  );
}

async function Manage() {
  const account = await requireStaff("hub", HUB_MANAGE_PATH);
  const [posts, bookings, campuses, notice] = await Promise.all([
    listPostsForStaff(),
    listBookings(),
    getCampuses(),
    takeNotice(),
  ]);
  return (
    <StaffFrame
      account={account}
      area={hubEyebrow(account)}
      title="Posts and office hours"
      route="/hub/manage"
      notice={staffNoticeText(notice)}
    >
      <HubManage
        posts={posts.filter((post) => canEditPost(account, post))}
        everyPost={isAdmin(account)}
        bookings={bookings}
        campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      />
    </StaffFrame>
  );
}
