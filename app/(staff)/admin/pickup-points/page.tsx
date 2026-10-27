import type { Metadata } from "next";
import { Reveal } from "@/components/kit/Reveal";
import { AdminPickupPoints, type PointForm } from "@/components/staff/AdminPickupPoints";
import { StaffFrame } from "@/components/staff/StaffFrame";
import { StaffSkeleton } from "@/components/staff/StaffSkeleton";
import { readFormState } from "@/lib/auth/form-state";
import { getCampuses } from "@/lib/data";
import { listPickupPoints } from "@/lib/data/pickup-points";
import { requireStaff, staffMetadata } from "@/lib/staff/access";
import { staffErrors } from "@/lib/staff/errors";
import { pointAddForm, pointRenameForm, takeNotice } from "@/lib/staff/form-state";
import { staffNoticeText } from "@/lib/staff/notices";
import { ADMIN_POINTS_PATH, STAFF_EYEBROW } from "@/lib/staff/paths";
import { PageTransition } from "@/components/kit/PageTransition";

export async function generateMetadata(): Promise<Metadata> {
  return staffMetadata("admin", "Pickup points");
}

/** Pickup points (staff tools spec 2.3, plan decision 10). */
export default function AdminPickupPointsPage() {
  return (
    <PageTransition>
      <Reveal fallback={<StaffSkeleton />}>
        <PickupPoints />
      </Reveal>
    </PageTransition>
  );
}

/** A failed post's typed name and errors, keyed as the view wants them; nothing for forms with no state. */
async function formsFor(keys: readonly { key: string; form: string; fieldId: string }[]) {
  const forms: Record<string, PointForm> = {};
  for (const { key, form, fieldId } of keys) {
    const state = await readFormState(form);
    if (state) forms[key] = { name: state.values.name ?? "", errors: staffErrors(state.errors, { name: fieldId }) };
  }
  return forms;
}

async function PickupPoints() {
  const account = await requireStaff("admin", ADMIN_POINTS_PATH);
  const [campuses, points, notice] = await Promise.all([getCampuses(), listPickupPoints(), takeNotice()]);
  const addForms = await formsFor(
    campuses.map((campus) => ({ key: campus.slug, form: pointAddForm(campus.slug), fieldId: `point-add-${campus.slug}-name` })),
  );
  const renameForms = await formsFor(
    points.map((point) => ({ key: point.id, form: pointRenameForm(point.id), fieldId: `point-${point.id}-name` })),
  );
  return (
    <StaffFrame account={account} area={STAFF_EYEBROW.admin} title="Pickup points" route="/admin/pickup-points" notice={staffNoticeText(notice)}>
      <AdminPickupPoints
        campuses={campuses.map((campus) => ({ slug: campus.slug, name: campus.name }))}
        points={points}
        addForms={addForms}
        renameForms={renameForms}
      />
    </StaffFrame>
  );
}
