import Link from "next/link";
import type { CSSProperties } from "react";
import { UserIcon } from "@/components/icons";
import { getViewer } from "@/lib/auth/session";
import { countNewNotifications } from "@/lib/data/notifications";

/**
 * The header's account icon (accounts spec 3.4): "Sign in" to /login when signed out, "Your account" to /account when
 * signed in. The layout renders it on the server and hands it to SiteHeader, so the header knows the session without
 * client code or a readable cookie (accounts plan decision 1). No prefetch, like the Saved link: the header is on
 * every page.
 *
 * Signed in, a red badge counts the new notifications (messaging spec 2.9, plan decision 10). It sits inside the
 * icon's box, so nothing moves as it streams in, and it describes the link ("2 new notifications") without changing
 * its name. Like everything in the layout, it's as fresh as the last full page load or post (plan decision 11).
 */
export function AccountLink({ signedIn, unread = 0 }: { signedIn: boolean; unread?: number }) {
  const badge = signedIn && unread > 0;
  // --i is the header's reveal stagger: fourth in its group, as before (spec section 6.2). Phones have the tab bar's
  // Account tab instead (components/tabbar/TabBar.tsx).
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      prefetch={false}
      aria-label={signedIn ? "Your account" : "Sign in"}
      aria-describedby={badge ? "hdr-account-new" : undefined}
      className="hdr-item icon-btn relative hidden wide:inline-grid"
      style={{ "--i": 3 } as CSSProperties}
    >
      <UserIcon />
      {badge && (
        <span id="hdr-account-new" className="hdr-badge hdr-badge-alert">
          {unread > 99 ? "99+" : unread}{" "}
          <span className="sr-only">{`new ${unread === 1 ? "notification" : "notifications"}`}</span>
        </span>
      )}
    </Link>
  );
}

/** The icon for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function HeaderAccount() {
  // A failed lookup counts as signed out rather than breaking the header; a failed count shows no badge.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountLink signedIn={false} />;
  const unread = await countNewNotifications(account.id).catch(() => 0);
  return <AccountLink signedIn unread={unread} />;
}
