import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { isFollowing } from "@/lib/data/follows";
import { followNoteKey } from "@/lib/following/rules";
import { takeNote } from "@/lib/looking-for/form-state";
import { shopSlugOf } from "@/lib/messaging/subjects";
import { SELL_PATH } from "@/lib/selling/paths";
import { FollowButtons, FollowSignedOut } from "./FollowViews";

/**
 * Follow once the session is read (community actions spec 2.16): the sign-in link when signed out, Back to your shop
 * for the shop's owner (F's Edit shop is in the band; role views spec 7.1), otherwise Follow or Unfollow with the last press's status line. An
 * async Server Component: FollowControl puts it inside <Suspense>. A failed session read gives the signed-out link.
 */
export async function ViewerFollow({ slug, name }: { slug: string; name: string }) {
  const account = await getViewer().catch(() => null);
  if (!account) return <FollowSignedOut slug={slug} name={name} />;
  // The owner's way back to the seller home (role views spec 7.1, Fixes), in the box Follow keeps for every viewer, so
  // nothing moves when it streams in. A white outline on the stars, as Unfollow.
  if (shopSlugOf(account) === slug) {
    return (
      <Link href={SELL_PATH} prefetch={false} className="btn seller-unfollow">
        Back to your shop
      </Link>
    );
  }
  const [following, note] = await Promise.all([isFollowing(account.id, slug), takeNote(followNoteKey(slug))]);
  return <FollowButtons slug={slug} name={name} following={following} notice={note?.notice ?? null} />;
}
