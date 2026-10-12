import { cookies } from "next/headers";
import { cache } from "react";
import { sampleActivity } from "@/data/fixtures/viewer";
import { CAMPUS_COOKIE, parseCampusChoice } from "@/lib/campus";
import type { Viewer } from "@/lib/types";
import { getCampuses } from "./index";

/**
 * Who is looking (spec section 13): the campus from the vossie_campus cookie, and whether they're signed in.
 *
 * Request-time: call it only inside <Suspense>, or the page can't be prerendered. React's cache() makes it one
 * cookie read per request. There are no accounts yet: VOSSIE_SAMPLE_SIGNED_IN=1 shows the signed-in context strip
 * with sample activity, in development only.
 */
export const getViewerContext = cache(async (): Promise<Viewer> => {
  const [store, campuses] = await Promise.all([cookies(), getCampuses()]);
  const campus = parseCampusChoice(store.get(CAMPUS_COOKIE)?.value, campuses);
  const signedIn = process.env.NODE_ENV !== "production" && process.env.VOSSIE_SAMPLE_SIGNED_IN === "1";
  return { campus, signedIn, activity: signedIn ? sampleActivity : null };
});
