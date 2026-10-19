"use server";

import { redirect } from "next/navigation";
import { writeFormState } from "@/lib/auth/form-state";
import { requireAccount } from "@/lib/auth/session";
import { addFollow, removeFollow, shopNameOf } from "@/lib/data/follows";
import { isId } from "@/lib/messaging/paths";
import { done, field } from "@/lib/selling/action-helpers";
import { followNoteKey, SAVED_SHOPS_FORM, savedTabPath } from "./rules";

// Follow and Unfollow (community actions spec 2.15 to 2.17; plan decisions 7 and 16): plain forms on the storefront's
// band and Saved's Shops tab, so they work before the app's JavaScript arrives. Identity comes only from the session;
// each lands back where it came from, with a status line there, and ends with F's done(), whose refresh() drops the
// browser's kept pages. Nothing buyers see changes (the storefront shows no count), so no tag is expired.

/** Where the button was: Saved's Shops tab (`from=saved`) or the shop's own storefront. */
function landingFor(formData: FormData, slug: string): { path: string; note: string } {
  return field(formData, "from") === "saved"
    ? { path: savedTabPath("shops"), note: SAVED_SHOPS_FORM }
    : { path: `/sellers/${slug}`, note: followNoteKey(slug) };
}

/** The shop's name for the status line, or "the shop" once it has gone. A shop the Hub paused still has its name. */
const shopName = async (slug: string) => (await shopNameOf(slug)) ?? "the shop";

/** Follow (spec 2.16): says so, or that 200 is the most; the owner's own shop and a second press say nothing. */
export async function followShop(formData: FormData): Promise<void> {
  const slug = field(formData, "shop");
  if (!isId(slug)) redirect("/");
  const { path, note } = landingFor(formData, slug);
  const account = await requireAccount(path);
  const now = new Date();
  const result = await addFollow(account.id, slug, now);
  if (result === "followed" || result === "limit") {
    const notice = result === "followed" ? "followed" : "follow-limit";
    await writeFormState(note, { errors: [], values: { shop: await shopName(slug) }, notice }, now);
  }
  done(path);
}

/** Unfollow (spec 2.16 and 2.17), from the band or Saved's Shops tab. */
export async function unfollowShop(formData: FormData): Promise<void> {
  const slug = field(formData, "shop");
  if (!isId(slug)) redirect("/");
  const { path, note } = landingFor(formData, slug);
  const account = await requireAccount(path);
  if (await removeFollow(account.id, slug)) {
    const shop = await shopName(slug);
    await writeFormState(note, { errors: [], values: { shop }, notice: "unfollowed" }, new Date());
  }
  done(path);
}
