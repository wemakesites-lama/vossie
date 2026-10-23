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
import { recentCounts } from "@/lib/data/shop-stats";
import { isId } from "@/lib/messaging/paths";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { checkInForm, noteForm, takeNotice } from "@/lib/staff/form-state";
import { MENTOR_WINDOW_DAYS } from "@/lib/staff/mentor";
import { issueOnceToken } from "@/lib/staff/once";
import { staffNoticeText } from "@/lib/staff/notices";
import { MENTOR_PATH, mentorShopPath } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("mentor", "A mentored shop");
}

/** One sample, so the build checks the request-time parts sit inside <Suspense> (CLAUDE.md). It matches no shop. */
export function generateStaticParams() {
  return [{ slug: "sample" }];
}

/** A shop's mentor page (staff tools spec 2.6; role views spec 7.3): its mentor or an admin; anyone else, or a shop with none, the 404. */
export default function MentorShopPage({ params }: PageProps<"/mentor/[slug]">) {
  return (
    <PageTransition>
      <Suspense fallback={<StaffSkeleton />}>
        <Shop params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function Shop({ params }: Pick<PageProps<"/mentor/[slug]">, "params">) {
  const { slug } = await params;
  const account = await requireStaff("mentor", mentorShopPath(slug));
  await connection();
  const now = new Date();
  const shop = isId(slug) ? await getMentoredShop(slug, account, now) : null;
  if (!shop) notFound();
  // A note and a check-in each get a one-time token, made now, at request time (staff tools amendment 15.7).
  const [campuses, notes, note, checkIn, notice, noteOnce, checkInOnce, previous] = await Promise.all([
    getCampuses(),
    listNotes(shop.ownerId),
    readFormState(noteForm(shop.slug)),
    readFormState(checkInForm(shop.slug)),
    takeNotice(),
    issueOnceToken(),
    issueOnceToken(),
    // getMentoredShop has checked the viewer may follow this shop: recentCounts reads with the admin client (N4 plan
    // decision 9), so it's called only after that check. N2's previous window (decision 10); on Supabase its
    // per-request cache means no second query.
    recentCounts(shop.slug, MENTOR_WINDOW_DAYS, now).then((counts) => counts.previous, () => null),
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
        noteOnce={noteOnce}
        checkInOnce={checkInOnce}
        today={sastDate(now)}
        previous={previous}
        now={now}
      />
    </StaffFrame>
  );
}
