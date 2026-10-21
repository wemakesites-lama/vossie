import "server-only";
import { earnedBadge } from "@/lib/selling/badges";
import type * as Sample from "../badges";
import { statsOver } from "../shop-stats";
import { forServer } from "./clients";
import { iso, selectAll } from "./rows";
import { conversationsOf } from "./shop-stats";

// Trust badges on Supabase (2b plan Task 19, decision 21), by the sample module's rule: only a shop an account owns,
// whose owner's seller profile isn't waiting (no profile counts as waiting), is worked out, from its record
// (statsOver over its conversations) and the owner's account's age; the shops no account owns keep their sample
// badges. It writes shops.badge where it changed, with the admin client: request-time code only (the admin's
// Overview), never inside "use cache". The caller still expires `sellers`. recalculateBadgeFor stays with messaging's
// conversations in the sample store until C3.

/** Every owned shop's badge (Overview). The slugs whose badge changed, A to Z. */
export const recalculateBadges: typeof Sample.recalculateBadges = async (now) => {
  const db = forServer();
  const shops = await selectAll(
    () => db.from("shops").select("id, slug, owner_id, badge").not("owner_id", "is", null),
    ["slug"],
  );
  const owners = shops.flatMap((shop) => (shop.owner_id ? [shop.owner_id] : []));
  if (owners.length === 0) return [];
  const [profiles, accounts] = await Promise.all([
    selectAll(() => db.from("seller_profiles").select("account_id, status").in("account_id", owners), ["account_id"]),
    selectAll(() => db.from("profiles").select("id, created_at").in("id", owners), ["id"]),
  ]);
  const statusOf = new Map(profiles.map((row) => [row.account_id, row.status]));
  const joined = new Map(accounts.map((row) => [row.id, iso(row.created_at)]));

  const changed: string[] = [];
  for (const shop of shops) {
    const owner = shop.owner_id;
    const createdAt = owner ? joined.get(owner) : undefined;
    if (!owner || !createdAt || (statusOf.get(owner) ?? "pending") === "pending") continue;
    const badge = earnedBadge(statsOver(await conversationsOf(shop.id), now).record, createdAt, now);
    if (shop.badge === badge) continue;
    const { error } = await db.from("shops").update({ badge }).eq("id", shop.id);
    if (error) throw new Error(error.message);
    changed.push(shop.slug);
  }
  return changed;
};
