import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Reveal } from "@/components/kit/Reveal";
import { ShowAgainConfirm } from "@/components/staff/ShowAgainConfirm";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { getHidden } from "@/lib/data/staff-reports";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { ADMIN_HIDDEN_PATH, showListingPath, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Show again");
}

/** One sample, as CLAUDE.md asks of every dynamic route. It matches no listing. */
export function generateStaticParams() {
  return [{ id: "l-sample" }];
}

/** Show a hidden listing again: its confirm page (stage J spec decision 14). One that isn't hidden is the 404. */
export default function ShowListingPage({ params }: PageProps<"/admin/hidden/listings/[id]">) {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton short />}>
        <Show params={params} />
      </Reveal>
    </PageTransition>
  );
}

async function Show({ params }: Pick<PageProps<"/admin/hidden/listings/[id]">, "params">) {
  const { id } = await params;
  const account = await requireStaff("admin", showListingPath(id));
  const item = isId(id) ? await getHidden("listing", id, account.id) : null;
  if (!item) notFound();
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title={`Show ${item.title} again`} current={ADMIN_HIDDEN_PATH} notice={null}>
      <ShowAgainConfirm item={item} />
    </StaffFrame>
  );
}
