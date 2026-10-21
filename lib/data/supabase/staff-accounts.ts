import "server-only";
import type * as Sample from "../staff-accounts";
import { forViewerAs } from "./viewer";

// Staff accounts on Supabase (C4/C5 plan Tasks 12 and 20). Task 12 adds only ownShopMentor; Task 20 the rest.

/**
 * Who mentors the viewing admin's own shop, read from staff_seller_profiles (a seller never reads who mentors them in
 * seller_profiles; an admin reads every row of the staff view). Null when nobody does, or they have no shop.
 */
export const ownShopMentor: typeof Sample.ownShopMentor = async (ownerId) => {
  const client = await forViewerAs(ownerId);
  const { data, error } = await client.from("staff_seller_profiles").select("mentor_id").eq("account_id", ownerId).maybeSingle();
  if (error) throw new Error(`staff_seller_profiles failed (${error.code ?? "unknown"})`);
  return data?.mentor_id ?? null;
};
