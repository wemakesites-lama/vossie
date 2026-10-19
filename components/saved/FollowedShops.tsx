import { getViewer } from "@/lib/auth/session";
import { getCampuses } from "@/lib/data";
import { listFollowedShops } from "@/lib/data/follows";
import { followNoticeText, SAVED_SHOPS_FORM } from "@/lib/following/rules";
import { takeNote } from "@/lib/looking-for/form-state";
import { FollowedShopsView } from "./FollowedShopsView";

/**
 * The Shops tab for this request's visitor (community actions spec 2.17). Request-time: inside Saved's <Suspense>. A
 * failed session read gives the signed-out version, whose sign-in link still works.
 */
export async function FollowedShops() {
  const account = await getViewer().catch(() => null);
  if (!account) return <FollowedShopsView shops={null} campusNames={new Map()} notice={null} />;
  const [shops, note, campuses] = await Promise.all([
    listFollowedShops(account.id),
    takeNote(SAVED_SHOPS_FORM),
    getCampuses(),
  ]);
  return (
    <FollowedShopsView
      shops={shops}
      campusNames={new Map(campuses.map((campus) => [campus.slug, campus.name]))}
      notice={followNoticeText(note?.notice, note?.values.shop ?? "the shop")}
    />
  );
}
