import { connection } from "next/server";
import { signInMode } from "@/lib/auth/config";
import { setFlash } from "@/lib/auth/cookies";
import { DELETE_FORM, writeFormState } from "@/lib/auth/form-state";
import { isSameOrigin, notFromVossie, seeOther } from "@/lib/auth/same-origin";
import { endSessionAfterDeletion, getViewer } from "@/lib/auth/session";
import { text } from "@/lib/auth/sign-in-finish";
import { deleteAccountData } from "@/lib/data/accounts";
import { liveUserId } from "@/lib/data/auth-session";
import { hubChangedNow, requestsChangedNow, sellersChangedNow } from "@/lib/data/tags";
import { signInHref } from "@/lib/next-path";

const PAGE = "/account/privacy";

/**
 * "Delete my account" (spec 2.13 and 3.3), only with the box ticked. Then the account and everything that hangs off it
 * go at once, this browser is signed out, and the homepage says so in a toast. A plain form post answered with 303, so
 * the browser loads the homepage as a new document and drops every signed-in page Next was keeping hidden, the account
 * page with the email among them (stage K decision 54; the same as signing out). The Origin is checked before
 * anything is read. The tags are expired with revalidateTag, since updateTag throws in a Route Handler.
 *
 * On Supabase (phase B decision 8, Task 7), the session is re-checked with Supabase Auth first (getUser), so a session
 * ended elsewhere can't delete while its access token's hour runs. If the deletion fails, nothing has changed (only
 * forget_account's failure throws: amendment 7), so the page says so and the session stays.
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return notFromVossie();
  // A malformed body (bad content type) is answered with a 303 back to the page, not a 500 (plan amendment 9).
  const data = await request.formData().catch(() => null);
  if (!data) return seeOther(PAGE);
  const account = await getViewer();
  if (!account) return seeOther(signInHref(PAGE));
  if (signInMode() === "supabase" && (await liveUserId()) !== account.id) return seeOther(signInHref(PAGE));
  if (text(data, "confirm") !== "yes") {
    await writeFormState(DELETE_FORM, { errors: ["confirm-missing"], values: {}, notice: null }, new Date());
    return seeOther(PAGE);
  }
  try {
    await deleteAccountData(account.id);
  } catch {
    await writeFormState(DELETE_FORM, { errors: ["delete-failed"], values: {}, notice: null }, new Date());
    return seeOther(PAGE);
  }
  // Its shop and listings have left the catalog (selling plan decision 22).
  if (account.seller) sellersChangedNow();
  // Its RSVPs have gone, so events' counts change (staff tools plan, Task 8).
  hubChangedNow();
  // Its requests have gone, and offers counts may have changed (community actions plan decision 10).
  requestsChangedNow();
  await endSessionAfterDeletion();
  await setFlash("deleted");
  return seeOther("/");
}

/** A link or a typed address deletes nothing: back to the page. Request-time, so the 303 is never a prerendered file. */
export async function GET(): Promise<Response> {
  await connection();
  return seeOther(PAGE);
}
