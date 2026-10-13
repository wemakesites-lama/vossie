import { ALL_CAMPUSES } from "@/lib/campus";
import { getCampuses } from "@/lib/data";
import { getViewerContext } from "@/lib/data/viewer";
import type { Handover } from "@/lib/types";

type CampusNoteProps = {
  campusSlug: string;
  campusName: string;
  handover: Handover;
};

/**
 * "Midrand isn't your chosen campus…" (spec 5.3): only for things you go somewhere for, and only when the viewer has
 * chosen another campus. It reads the campus cookie, so it sits inside <Suspense> and renders per request: the only
 * part of a listing page that does. For anything online it returns before reading the cookie, so that page stays
 * fully prerendered.
 */
export async function CampusNote({ campusSlug, campusName, handover }: CampusNoteProps) {
  if (handover !== "pickup" && handover !== "on-campus") return null;
  const { campus } = await getViewerContext();
  if (campus === ALL_CAMPUSES || campus === campusSlug) return null;
  const campuses = await getCampuses().catch(() => null);
  const yours = campuses?.find((item) => item.slug === campus)?.name;
  if (!yours) return null;
  return (
    <p className="campus-note">
      {campusName} isn&apos;t your chosen campus ({yours}), so you&apos;d go there for this. Delivery between campuses
      isn&apos;t available yet.
    </p>
  );
}
