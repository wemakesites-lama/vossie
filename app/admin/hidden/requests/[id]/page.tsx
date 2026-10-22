import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ShowAgainConfirm } from "@/components/staff/ShowAgainConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getHidden } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_HIDDEN_PATH, showRequestPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Show again");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no request. */
export function generateStaticParams() {
  return [{ id: "r-sample" }];
}

/** Show a hidden request again: its confirm page (stage J spec decision 14). One that isn't hidden is the 404. */
export default function ShowRequestPage({ params }: PageProps<"/admin/hidden/requests/[id]">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton short />}>
        <Show params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Show({ params }: Pick<PageProps<"/admin/hidden/requests/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", showRequestPath(id));
  const item = isId(id) ? await getHidden("request", id, account.id) : null;
  if (!item) notFound();
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={`Show ${item.title} again`} current={ADMIN_HIDDEN_PATH} notice={null}>
      <ShowAgainConfirm item={item} />
    </StaffFrame>
  );
}
