import { readFormState, writeFormState } from "@/lib/auth/form-state";
import { getSessionKey } from "@/lib/auth/session";
import { clearFormState } from "@/lib/data/form-states";

// The staff forms' names in D's form state (accounts plan decision 3): their errors and typed values, per browser
// session, for 10 minutes. One per form and thing, so two drafts never mix. And the notice a page shows once after an
// action (spec 4: "Status changes after a post show a status message at the top of the page").

/** Staff pages' notice: one per session, taken by the page the action lands on. */
export const STAFF_NOTICE = "staff-notice";
/** A student's notice on a Hub post or its slot request page (plan decision 13), kept apart from staff's. */
export const HUB_NOTICE = "hub-notice";

export const declineForm = (slug: string) => `decline:${slug}`;
export const shopPauseForm = (slug: string) => `shop-pause:${slug}`;
export const dismissForm = (reportId: string) => `dismiss:${reportId}`;
export const hideForm = (reportId: string) => `hide:${reportId}`;
export const reportPauseForm = (reportId: string) => `report-pause:${reportId}`;
export const PIN_FORM = "featured-pin";
export const pointAddForm = (campusSlug: string) => `point-add:${campusSlug}`;
export const pointRenameForm = (id: string) => `point-rename:${id}`;
export const postForm = (id: string | null) => (id ? `post:${id}` : "post:new");
export const noteForm = (slug: string) => `mentor-note:${slug}`;
export const checkInForm = (slug: string) => `check-in:${slug}`;
export const slotForm = (postId: string) => `slot:${postId}`;

/** Forgets this browser's state for `form`. Signed out, it does nothing. */
export async function clearStaffForm(form: string): Promise<void> {
  const sessionKey = await getSessionKey();
  if (sessionKey) await clearFormState(sessionKey, form);
}

/** Leaves a notice code (lib/staff/notices.ts) for the page the action lands on. Server Actions only. */
export async function leaveNotice(code: string, now: Date, key = STAFF_NOTICE): Promise<void> {
  await writeFormState(key, { errors: [], values: {}, notice: code }, now);
}

/**
 * The notice an action left, read and cleared in one go, so it shows once (messaging plan decision 7's pattern).
 * Request-time: call it inside <Suspense>.
 */
export async function takeNotice(key = STAFF_NOTICE): Promise<string | null> {
  const state = await readFormState(key);
  if (!state?.notice) return null;
  await clearStaffForm(key);
  return state.notice;
}
