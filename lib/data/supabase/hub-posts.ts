import "server-only";
import type { HubPost, HubPostKind } from "@/lib/types";
import type * as Sample from "../hub-posts";
import { HUB_BANNER_IMAGE, toHubPost } from "../hub-posts";
import { tagHub } from "../tags";
import { forPublic } from "./clients";
import { type AsyncTwin, campusFromDb, iso, selectAll } from "./rows";

// The Hub's public posts on Supabase (2b plan Task 16): the sample module's public reads, over the hub_cards view,
// which shows published posts only, with an event's count and its RSVPs added (going_now), and no author. Staff's
// writes, RSVPs and slot requests stay in the sample module until C2 and C5.

/**
 * Every published post as buyers see it, by id (the samples' h-001 to h-018 come out in the store's order), through
 * the cookieless client. Cached, tagged `hub`.
 * - A cover photo is served at /photos/<uuid> (C2 serves covers, and refuses a draft's: step 2 review M4); otherwise
 *   the post's placeholder art, or the Hub's banner.
 * - The campus is "all" where the database has null (spec amendment 12.2).
 */
export async function publishedPostRows(): Promise<HubPost[]> {
  "use cache";
  tagHub();
  const rows = await selectAll(
    () =>
      forPublic()
        .from("hub_cards")
        .select(
          "id, kind, title, summary, place, body, campus_slug, starts_at, capacity, going_now, image_src, image_alt, cover_photo_id, published_at, created_at",
        ),
    ["id"],
  );
  return rows.flatMap((row) => {
    if (!row.id || !row.kind || !row.title || row.summary === null || row.body === null || !row.created_at) return [];
    const image = row.cover_photo_id
      ? { src: `/photos/${row.cover_photo_id}`, alt: "" }
      : { src: row.image_src ?? HUB_BANNER_IMAGE.src, alt: row.image_alt ?? "" };
    return [
      toHubPost(
        {
          id: row.id,
          kind: row.kind as HubPostKind,
          title: row.title,
          summary: row.summary,
          place: row.place,
          body: row.body,
          campusSlug: campusFromDb(row.campus_slug),
          startsAt: iso(row.starts_at),
          capacity: row.capacity,
          image,
          publishedAt: iso(row.published_at ?? row.created_at),
          createdAt: iso(row.created_at),
        },
        row.going_now,
      ),
    ];
  });
}

/** The published posts, for the feed, the homepage's What's on and post pages. */
export const publishedPosts: AsyncTwin<typeof Sample.publishedPosts> = async () => publishedPostRows();

/** A published post's page; null for a draft or an unknown id, which answer 404. */
export const publishedPost: AsyncTwin<typeof Sample.publishedPost> = async (id) =>
  (await publishedPostRows()).find((post) => post.id === id) ?? null;
