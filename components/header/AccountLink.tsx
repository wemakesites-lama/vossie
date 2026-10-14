import Link from "next/link";
import type { CSSProperties } from "react";
import { UserIcon } from "@/components/icons";
import { getViewer } from "@/lib/auth/session";

/**
 * The header's account icon (accounts spec 3.4): "Sign in" to /login when signed out, "Your account" to /account when
 * signed in. The layout renders it on the server and hands it to SiteHeader, so the header knows the session without
 * client code or a readable cookie (plan decision 1). No prefetch, like the Saved link: the header is on every page.
 */
export function AccountLink({ signedIn }: { signedIn: boolean }) {
  // --i is the header's reveal stagger: fourth in its group, as before (spec section 6.2).
  return (
    <Link
      href={signedIn ? "/account" : "/login"}
      prefetch={false}
      aria-label={signedIn ? "Your account" : "Sign in"}
      className="hdr-item icon-btn"
      style={{ "--i": 3 } as CSSProperties}
    >
      <UserIcon />
    </Link>
  );
}

/** The icon for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function HeaderAccount() {
  // A failed lookup counts as signed out rather than breaking the header.
  const account = await getViewer().catch(() => null);
  return <AccountLink signedIn={account !== null} />;
}
