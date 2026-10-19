import Link from "next/link";
import { followShop, unfollowShop } from "@/lib/following/actions";
import { followNoticeText, UNFOLLOWED_SHORT } from "@/lib/following/rules";
import { signInHref } from "@/lib/next-path";

// The versions of Follow on the storefront's band (community actions plan, Task 17). Pure views with no session:
// FollowControl (the <Suspense>) and ViewerFollow (the session's part) both use them, so neither imports the other, and
// the test stand-in for ViewerFollow can use them without an import loop.

type FollowProps = { slug: string; name: string };

/**
 * Follow for a signed-out visitor, and the static shell: sign in, then back to the shop (spec 2.16). Never a link
 * straight at a page that needs sign-in (plan amendment 18): this one goes to sign-in itself.
 */
export function FollowSignedOut({ slug, name }: FollowProps) {
  return (
    <Link href={signInHref(`/sellers/${slug}`)} prefetch={false} className="btn btn-sky seller-follow-btn">
      Follow <span className="sr-only">{name}</span>
    </Link>
  );
}

type FollowButtonsProps = FollowProps & {
  following: boolean;
  /** The last press's code, once (plan decision 7): "followed", "unfollowed" or "follow-limit". */
  notice: string | null;
};

/**
 * Follow, or "You follow this shop" and Unfollow (spec 2.16): one form button each, so they work before the app's
 * JavaScript arrives. The words say what the button does, so it has no pressed state.
 */
export function FollowButtons({ slug, name, following, notice }: FollowButtonsProps) {
  if (following) {
    const followed = notice === "followed";
    return (
      <>
        <p className="seller-follow-note" role={followed ? "status" : undefined}>
          {followed ? followNoticeText("followed", name) : "You follow this shop"}
        </p>
        <form action={unfollowShop}>
          <input type="hidden" name="shop" value={slug} />
          <button type="submit" className="btn seller-unfollow">
            Unfollow <span className="sr-only">{name}</span>
          </button>
        </form>
      </>
    );
  }
  return (
    <>
      <form action={followShop}>
        <input type="hidden" name="shop" value={slug} />
        <button type="submit" className="btn btn-sky seller-follow-btn">
          Follow <span className="sr-only">{name}</span>
        </button>
      </form>
      {notice === "unfollowed" && (
        <p role="status" className="seller-follow-note">
          {UNFOLLOWED_SHORT}
        </p>
      )}
      {notice === "follow-limit" && (
        <p role="status" className="seller-follow-note">
          {followNoticeText("follow-limit", name)}
        </p>
      )}
    </>
  );
}
