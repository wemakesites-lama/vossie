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
// Overview, and messaging's actions after a reply or a sale), never inside "use cache". The caller still expires
// `sellers`.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type OwnedShop = { id: string; slug: string; owner_id: string | null; badge: string | null };

/** Works out the shops' badges, writing each that changed. The slugs whose badge changed, in the shops' order. */
async function recalculate(shops: readonly OwnedShop[], now: Date): Promise<string[]> {
  const db = forServer();
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
}

/** Every owned shop's badge (Overview). The slugs whose badge changed, A to Z. */
export const recalculateBadges: typeof Sample.recalculateBadges = async (now) => {
  const shops = await selectAll(
    () => forServer().from("shops").select("id, slug, owner_id, badge").not("owner_id", "is", null),
    ["slug"],
  );
  return recalculate(shops, now);
};

/**
 * The badge of the shop a conversation is with, after a reply or a confirmed sale (fix 8 of the review after C2 and
 * C3): the same rule, for that one shop. False for an id that isn't a conversation's, or a conversation whose shop has
 * gone (shop_id null once its owner deleted their account).
 */
export const recalculateBadgeFor: typeof Sample.recalculateBadgeFor = async (conversationId, now) => {
  if (!UUID.test(conversationId)) return false;
  const db = forServer();
  const conversation = await db.from("conversations").select("shop_id").eq("id", conversationId).maybeSingle();
  if (conversation.error) throw new Error(conversation.error.message);
  const shopId = conversation.data?.shop_id;
  if (!shopId) return false;
  const shop = await db.from("shops").select("id, slug, owner_id, badge").eq("id", shopId).maybeSingle();
  if (shop.error) throw new Error(shop.error.message);
  return shop.data ? (await recalculate([shop.data], now)).length > 0 : false;
};
