import Link from "next/link";
import { UserIcon } from "@/components/icons";
import { getViewer } from "@/lib/auth/session";
import { forYouTotal } from "@/lib/you/model";
import { readForYou } from "@/lib/you/read";

/**
 * The header's account icon (accounts spec 3.4): "Sign in" to /login when signed out, "Your account" to /account when
 * signed in. The layout renders it on the server and hands it to SiteHeader (accounts plan decision 1). No prefetch,
 * like the Saved link: the header is on every page.
 *
 * Signed in, a red badge counts For you, the same sum as the You tab (role views N5, plan decision 7), from the same
 * read. It sits inside the icon's box, so nothing moves as it streams in, and it describes the link ("3 things for
 * you") without changing its name. Like everything in the layout, it's as fresh as the last full page load or post.
 */
export function AccountLink({ signedIn, forYou = 0 }: { signedIn: boolean; forYou?: number }) {
  const badge = signedIn && forYou > 0;
  // Phones have the tab bar's You tab instead (components/tabbar/TabBar.tsx).
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      prefetch={false}
      aria-label={signedIn ? "Your account" : "Sign in"}
      aria-describedby={badge ? "hdr-account-new" : undefined}
      className="hdr-item icon-btn relative hidden wide:inline-grid"
    >
      <UserIcon />
      {badge && (
        <span id="hdr-account-new" className="hdr-badge hdr-badge-alert">
          {forYou > 99 ? "99+" : forYou}{" "}
          <span className="sr-only">{`${forYou === 1 ? "thing" : "things"} for you`}</span>
        </span>
      )}
    </Link>
  );
}

/** The icon for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function HeaderAccount() {
  // A failed lookup counts as signed out rather than breaking the header; a failed read shows no badge.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountLink signedIn={false} />;
  const forYou = await readForYou(account.id)
    .then((read) => forYouTotal(read.items))
    .catch(() => 0);
  return <AccountLink signedIn forYou={forYou} />;
}
