import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MentorShop } from "@/components/staff/MentorShop";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { getMentoredShop, listNotes } from "@/lib/data/mentors";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { checkInForm, noteForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "A mentored shop");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's mentor page (staff tools spec 2.6): its mentor or an admin; anyone else, or a shop with none, the 404. */
export default function MentorShopPage({ params }: PageProps<"/mentor/[slug]">) {
  return (
    <Suspense fallback={<StaffSkeleton />}>
      <Shop params={params} />
    </Suspense>
  );
}

async function Shop({ params }: Pick<PageProps<"/mentor/[slug]">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("mentor", mentorShopPath(slug));
  await connection();
  const now = new Date();
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  const [campuses, notes, note, checkIn, notice] = await Promise.all([
    getCampuses(),
    listNotes(shop.ownerId),
    readFormState(noteForm(shop.slug)),
    readFormState(checkInForm(shop.slug)),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area="Mentoring" title={shop.name} current={MENTOR_PATH} notice={staffNoticeText(notice)}>
      <MentorShop
        shop={shop}
        campusName={campuses.find((campus) => campus.slug === shop.campusSlug)?.name ?? ""}
        notes={notes}
        noteForm={{ values: note?.values ?? {}, errors: staffErrors(note?.errors ?? [], staffFieldIds(`note-${shop.slug}`)) }}
        checkInForm={{
          values: checkIn?.values ?? {},
          errors: staffErrors(checkIn?.errors ?? [], staffFieldIds(`check-in-${shop.slug}`)),
        }}
        today={sastDate(now)}
      />
    </StaffFrame>
  );
}
