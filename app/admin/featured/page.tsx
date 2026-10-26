import type { Metadata } from "next";
import { connection } from "next/server";
import { Reveal } from "@/components/kit/Reveal";
import { AdminFeatured } from "@/components/staff/AdminFeatured";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { featuredChoices, featuredFor, listPins } from "@/lib/data/featured";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors, staffFieldIds } from "@/lib/staff/errors";
import { PIN_FORM, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_FEATURED_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";
import { sastDate } from "@/lib/time";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Featured");
}

/** Featured (staff tools spec 2.3 and 2.8). */
export default function AdminFeaturedPage() {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <Featured />
      </Reveal>
    </PageTransition>
  );
}

async function Featured() {
  const account = await requireStaff("admin", ADMIN_FEATURED_PATH);
  // Today's date reads the clock (decision 26).
  await connection();
  const today = sastDate(new Date());
  const campuses = await getCampuses();
  const places = [
    { slug: ALL_CAMPUSES, name: "No campus chosen" },
    ...campuses.map((campus) => ({ slug: campus.slug, name: campus.name })),
  ];
  // Each row as visitors see it; one not drawn yet today is drawn and recorded now, as a visit would (plan decision 9).
  const rows = await Promise.all(
    places.map(async (place) => ({ campus: place, sellers: await featuredFor(place.slug, today) })),
  );
  // The admin's own shop isn't a choice and its pins aren't theirs to remove (stage L spec decision 1); the field
  // says so when it would have been listed (plan decision 4).
  const [pins, everyone, choices, state, notice] = await Promise.all([
    listPins(today, account.id),
    featuredChoices(),
    featuredChoices(account.id),
    readFormState(PIN_FORM),
    takeNotice(),
  ]);
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Featured" current={ADMIN_FEATURED_PATH} notice={staffNoticeText(notice)}>
      <AdminFeatured
        today={today}
        rows={rows}
        pins={pins}
        choices={choices}
        ownLeftOut={choices.length < everyone.length}
        places={places}
        values={state?.values ?? {}}
        errors={staffErrors(state?.errors ?? [], staffFieldIds("pin"))}
      />
    </StaffFrame>
  );
}
