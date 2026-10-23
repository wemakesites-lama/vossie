import { cookies } from "next/headers";
import { cache } from "react";
import { getViewer } from "@/lib/auth/session";
import { CAMPUS_COOKIE, parseCampusChoice } from "@/lib/campus";
import type { Viewer, ViewerActivity } from "@/lib/types";
import { getAccountActivity } from "./accounts";
import { getCampuses } from "./index";

/** Activity worth a "Welcome back" strip: any number above zero. Otherwise the strip falls back (accounts spec 3.4). */
function worthShowing(activity: ViewerActivity | null): ViewerActivity | null {
  if (!activity) return null;
  return activity.newMessages + activity.salesToConfirm + activity.newNotifications > 0 ? activity : null;
}

/**
 * Who is looking (spec section 13): the campus from the vossie_campus cookie and, from the session, whether they're
 * signed in and what the context strip should say (accounts spec 2.9 and 3.4).
 *
 * Request-time: call it only inside <Suspense>, or the page can't be prerendered. React's cache() makes it one read
 * per request.
 */
export const getViewerContext = cache(async (): Promise<Viewer> => {
  // Every section awaits the viewer before its own error handling, so a failed campus or session lookup must not
  // escape here. With no campuses the choice reads as "all campuses"; with no session, signed out.
  const [store, campuses, account] = await Promise.all([
    cookies(),
    getCampuses().catch(() => []),
    getViewer().catch(() => null),
  ]);
  const campus = parseCampusChoice(store.get(CAMPUS_COOKIE)?.value, campuses);
  if (!account) return { campus, signedIn: false, activity: null };
  // getViewer awaited connection() before it found the account, so the clock can be read here (decision 26).
  const activity = await getAccountActivity(account.id, new Date()).catch(() => null);
  return { campus, signedIn: true, activity: worthShowing(activity) };
});
