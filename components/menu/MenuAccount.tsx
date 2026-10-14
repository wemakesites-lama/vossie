import { NavLink } from "@/components/ui/NavLink";
import { signOut } from "@/lib/auth/actions";
import { getViewer } from "@/lib/auth/session";

/**
 * The menu's account rows (accounts spec 3.4): "Sign in" when signed out; "Your account" and Sign out when signed in.
 * Rendered on the server and handed to MenuDrawer, like the header's icon (plan decision 1). Sign out is a plain form
 * posting to a Server Action; the menu closes as it's pressed (plan decision 14).
 */
export function MenuAccountLinks({ signedIn }: { signedIn: boolean }) {
  if (!signedIn) {
    return (
      <li>
        <NavLink href="/login">Sign in</NavLink>
      </li>
    );
  }
  return (
    <>
      <li>
        <NavLink href="/account">Your account</NavLink>
      </li>
      <li>
        <form action={signOut}>
          <button type="submit" className="menu-link-button menu-signout">
            Sign out
          </button>
        </form>
      </li>
    </>
  );
}

/** The rows for this request's session. Request-time, so the layout puts them inside <Suspense>. */
export async function MenuAccount() {
  const account = await getViewer().catch(() => null);
  return <MenuAccountLinks signedIn={account !== null} />;
}
