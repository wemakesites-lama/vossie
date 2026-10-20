import type { ReactNode } from "react";
import { SAVED_COUNT_ID, SavedCount } from "@/components/header/SavedLink";
import { BagIcon, HeartIcon, HomeIcon, PlusIcon, UserIcon } from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { getViewer } from "@/lib/auth/session";
import { countNewNotifications } from "@/lib/data/notifications";

/**
 * The phone tab bar (spec section 6.2): Home, Shop, Sell, Saved and Account, fixed to the bottom of the screen below
 * the tablet step and always visible, so the main places are one thumb's tap away while the header is hidden.
 * Rendered on the server: the only client code is NavLink (already in the header's chunk) and Saved's count.
 *
 * Only Home and Sell prefetch, as the header already does; the other three would cost their route's chunk on every
 * page on mobile data (decision 53).
 */
export function TabBar({ account }: { account: ReactNode }) {
  return (
    <nav aria-label="Main" className="tabbar">
      <ul>
        <li>
          <Tab href="/" icon={<HomeIcon />} label="Home" />
        </li>
        <li>
          <Tab href="/browse" icon={<BagIcon />} label="Shop" match="section" prefetch={false} />
        </li>
        <li>
          <Tab href="/sell" icon={<PlusIcon />} label="Sell" match="section" className="tab tab-sell" />
        </li>
        <li>
          <Tab href="/saved" icon={<HeartIcon />} label="Saved" prefetch={false} describedBy={SAVED_COUNT_ID}>
            <SavedCount />
          </Tab>
        </li>
        {/* AccountTab, or TabAccount in <Suspense>: the layout passes it, as it does the header's icon. */}
        <li>{account}</li>
      </ul>
    </nav>
  );
}

type TabProps = {
  href: string;
  icon: ReactNode;
  label: string;
  match?: "section";
  prefetch?: false;
  className?: string;
  describedBy?: string;
  children?: ReactNode;
};

function Tab({ href, icon, label, match, prefetch, className = "tab", describedBy, children }: TabProps) {
  return (
    <NavLink href={href} match={match} prefetch={prefetch} className={className} describedBy={describedBy}>
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
      {children}
    </NavLink>
  );
}

/**
 * Account: /account when signed in, with the header icon's red badge for new notifications (messaging spec 2.9),
 * which describes the tab without changing its name, as the header's does; sign-in when signed out, never the gated
 * page itself (CLAUDE.md).
 */
export function AccountTab({ signedIn, unread = 0 }: { signedIn: boolean; unread?: number }) {
  const badge = signedIn && unread > 0;
  return (
    <Tab
      href={signedIn ? "/account" : "/login"}
      icon={<UserIcon />}
      label="Account"
      match="section"
      prefetch={false}
      describedBy={badge ? "tab-account-new" : undefined}
    >
      {badge && (
        // Hidden from the name (the tab has no aria-label), still read as its description.
        <span id="tab-account-new" className="hdr-badge hdr-badge-alert" aria-hidden="true">
          {unread > 99 ? "99+" : unread}{" "}
          <span className="sr-only">{`new ${unread === 1 ? "notification" : "notifications"}`}</span>
        </span>
      )}
    </Tab>
  );
}

/** The tab for this request's session. Request-time, so the layout puts it inside <Suspense>. */
export async function TabAccount() {
  // As the header's icon: a failed lookup counts as signed out, a failed count shows no badge. getViewer is one
  // lookup per render (React's cache), shared with the header.
  const account = await getViewer().catch(() => null);
  if (!account) return <AccountTab signedIn={false} />;
  const unread = await countNewNotifications(account.id).catch(() => 0);
  return <AccountTab signedIn unread={unread} />;
}
