import "server-only";
import type { Account, SellerStatus, StaffRole } from "@/lib/types";
import type * as Sample from "../accounts";
import { assembleExport } from "../accounts";
import { currentClaims } from "./auth-session";
import { forServer, forViewer } from "./clients";
import { unreadCounts } from "./messages";
import { iso } from "./rows";

// Accounts on Supabase (phase B, Task 4; decisions 7 to 9; amendments 7 and 10). An account is a Supabase Auth user
// with a profile: Auth makes the user at the code, complete_profile the profile at step 3. Everything here is the
// signed-in person's own, through the viewer's client, and a twin never trusts an account id it's given over the
// session (2b plan decision 20): another account's id is phase C's (the staff reads), and throws until then. Deleting
// an account goes through the admin client.

/** Photo files are removed from Storage in batches this size (Storage's limit per call). */
const REMOVE_BATCH = 1_000;
const PHOTOS_BUCKET = "photos";

function failed(what: string, error: { code?: string }): never {
  throw new Error(`${what} failed (${error.code ?? "unknown"})`);
}

/** The signed-in account's id, or a throw naming the call: an id that isn't the session's is never acted on. */
async function ownId(accountId: string, what: string): Promise<string> {
  const claims = await currentClaims();
  if (!claims || claims.userId !== accountId) throw new Error(`${what}() acts only for the signed-in account`);
  return claims.userId;
}

/** The roles in the order the app keeps them (mentor, admin), from the profile. */
const rolesOf = (roles: string[]): StaffRole[] => roles.filter((role): role is StaffRole => role === "mentor" || role === "admin");

/**
 * The account a verified session names, read on every request (roles included; nothing cached reads them), or null
 * when it has no profile (decision 7). The address comes from the verified claims. A waiting shop has no link yet, as
 * in the sample store, which sets it at approval.
 */
export const getViewerAccount: typeof Sample.getViewerAccount = async (claims) => {
  const viewer = await forViewer();
  const profile = await viewer
    .from("profiles")
    .select("id, first_name, campus_slug, roles, created_at")
    .eq("id", claims.userId)
    .maybeSingle();
  if (profile.error) failed("profiles", profile.error);
  if (!profile.data) return null;
  const seller = await viewer.from("seller_profiles").select("status, shop_id").eq("account_id", claims.userId).maybeSingle();
  if (seller.error) failed("seller_profiles", seller.error);
  let sellerProfile: Account["seller"] = null;
  if (seller.data) {
    const status = seller.data.status as SellerStatus;
    let sellerSlug: string | null = null;
    if (status !== "pending" && seller.data.shop_id) {
      const shop = await viewer.from("shops").select("slug").eq("id", seller.data.shop_id).maybeSingle();
      if (shop.error) failed("shops", shop.error);
      sellerSlug = shop.data?.slug ?? null;
    }
    sellerProfile = { status, sellerSlug };
  }
  return {
    id: profile.data.id,
    email: claims.email,
    firstName: profile.data.first_name,
    campusSlug: profile.data.campus_slug,
    roles: rolesOf(profile.data.roles),
    seller: sellerProfile,
    createdAt: iso(profile.data.created_at),
  };
};

/** The signed-in account's own, by its id. Any other id is a staff read, which phase C moves. */
export const getAccount: typeof Sample.getAccount = async (id) => {
  const claims = await currentClaims();
  if (!claims || claims.userId !== id) throw new Error("getAccount() for another account is phase C's (the staff reads)");
  return getViewerAccount(claims);
};

/** Not on Supabase's sign-in path: finishCode asks hasProfile(userId) instead (Task 5). A phase C caller may need it. */
export const findAccountByEmail: typeof Sample.findAccountByEmail = async () => {
  throw new Error("findAccountByEmail() isn't on Supabase yet: sign-in asks hasProfile()");
};

/** Accounts are made by Supabase Auth (the code) and complete_profile (step 3), never directly. */
export const createAccount: typeof Sample.createAccount = async () => {
  throw new Error("createAccount() isn't on Supabase: Supabase Auth and complete_profile make accounts");
};

/** Whether the signed-in account has a profile yet, right after its code was checked (Task 5). */
export const hasProfile: typeof Sample.hasProfile = async (userId) => {
  const { data, error } = await (await forViewer()).from("profiles").select("id").eq("id", userId).maybeSingle();
  if (error) failed("profiles", error);
  return data !== null;
};

/** Step 3 (decision 9): the profile made, and consent recorded at this moment by the database. The session says who. */
export const completeProfile: typeof Sample.completeProfile = async ({ firstName, campusSlug, policyVersion }) => {
  const { data, error } = await (await forViewer()).rpc("complete_profile", {
    p_first_name: firstName,
    p_campus_slug: campusSlug,
    p_policy_version: policyVersion,
  });
  if (error) failed("complete_profile", error);
  return data === true;
};

/** Edit details: update_profile, then the account as it now is. Null when it has no profile. */
export const updateAccountDetails: typeof Sample.updateAccountDetails = async (id, details) => {
  await ownId(id, "updateAccountDetails");
  const { data, error } = await (await forViewer()).rpc("update_profile", {
    p_first_name: details.firstName,
    p_campus_slug: details.campusSlug,
  });
  if (error) failed("update_profile", error);
  if (data !== true) return null;
  const claims = await currentClaims();
  return claims ? getViewerAccount(claims) : null;
};

/** A returning sign-in's consent (decision 9): record_consent stamps the database's time, so `at` isn't sent. */
export const recordConsent: typeof Sample.recordConsent = async (accountId, version) => {
  await ownId(accountId, "recordConsent");
  const { error } = await (await forViewer()).rpc("record_consent", { p_policy_version: version });
  if (error) failed("record_consent", error);
};

export const getLatestConsent: typeof Sample.getLatestConsent = async (accountId) => {
  const { data, error } = await (await forViewer())
    .from("consents")
    .select("version, agreed_at")
    .eq("account_id", accountId)
    .order("agreed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) failed("consents", error);
  return data ? { version: data.version, agreedAt: iso(data.agreed_at) } : null;
};

/**
 * The context strip's numbers (spec 2.9 and 3.4; C2/C3 plan amendment 11): the messaging counts' twin, my_unread_counts,
 * which writes nothing (a sale past its 7 days counts as settled already). Only the signed-in account's, through
 * forViewerAs; a session always names an account with a profile here, since getViewer() found it.
 */
export const getAccountActivity: typeof Sample.getAccountActivity = async (accountId, now) => {
  const counts = await unreadCounts(accountId, now);
  return { newMessages: counts.messages, salesToConfirm: counts.salesToConfirm, savedItemsBack: 0 };
};

/** Sample mode is off on Supabase, so no sample account comes back. */
export const restoreSampleAccount: typeof Sample.restoreSampleAccount = async () => null;

/**
 * Download your data (spec 3.3): the account, its consents and its sessions from Supabase; every other section from
 * its own module, on whichever backend that module is (phase C moves them). The sample's key order (assembleExport).
 */
export const exportAccountData: typeof Sample.exportAccountData = async (accountId, now) => {
  const account = await getAccount(accountId);
  if (!account) return null;
  const { data, error } = await (await forViewer())
    .from("consents")
    .select("version, agreed_at")
    .eq("account_id", accountId)
    .order("agreed_at")
    .order("id");
  if (error) failed("consents", error);
  const consents = (data ?? []).map((row) => ({ policy: row.version, agreedAt: iso(row.agreed_at) }));
  return assembleExport({ account, consents }, now);
};

/** A deleted account's photo files, in batches. A failure is logged with its status and the count, never a path. */
async function removePhotoFiles(paths: readonly string[]): Promise<void> {
  const storage = forServer().storage.from(PHOTOS_BUCKET);
  for (let start = 0; start < paths.length; start += REMOVE_BATCH) {
    const batch = paths.slice(start, start + REMOVE_BATCH);
    try {
      const { error } = await storage.remove([...batch]);
      if (error) {
        const status = (error as { statusCode?: string; status?: number }).statusCode ?? (error as { status?: number }).status;
        console.error(`[vossie] Removing ${batch.length} file(s) from photos failed (${status ?? "unknown"}); no photo row names them now.`);
      }
    } catch {
      console.error(`[vossie] Removing ${batch.length} file(s) from photos failed (unreachable); no photo row names them now.`);
    }
  }
}

/**
 * Deletes an account straight away (spec 2.13; decision 8). forget_account removes everything of the account's in one
 * transaction and gives back its photo files' paths; a rare deadlock with a message or an offer sent at the same moment
 * aborts it, so it's tried once more. Only its failure throws, and then nothing changed (amendment 7). After it, a
 * Storage failure leaves files no photo row names (C2's sweep), and an Auth failure leaves a user with no profile, which
 * sweep_unfinished_users removes within a day: both are logged by status only, never the id or the address.
 */
export const deleteAccountData: typeof Sample.deleteAccountData = async (accountId) => {
  const admin = forServer();
  const forget = () => admin.rpc("forget_account", { p_account_id: accountId });
  let { data: paths, error } = await forget();
  if (error?.code === "40P01") ({ data: paths, error } = await forget());
  if (error) failed("forget_account", error);
  if (paths && paths.length > 0) await removePhotoFiles(paths);
  try {
    const { error: authError } = await admin.auth.admin.deleteUser(accountId, false);
    if (authError) console.error(`[vossie] Auth user delete failed (${authError.status ?? "unknown"}); the daily sweep removes it.`);
  } catch {
    console.error("[vossie] Auth user delete failed (unreachable); the daily sweep removes it.");
  }
};
