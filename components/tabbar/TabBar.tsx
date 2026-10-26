import { connection } from "next/server";
import type { ReactNode } from "react";
import { SavedCount } from "@/components/header/SiteHeader";
import {
  BagIcon,
  GridIcon,
  HeartIcon,
  HomeIcon,
  MessageIcon,
  PlusIcon,
  StoreIcon,
  UserIcon,
} from "@/components/icons";
import { NavLink } from "@/components/ui/NavLink";
import { getViewer } from "@/lib/auth/session";
import { openBookingCount } from "@/lib/data/hub-posts";
import { openReportCount } from "@/lib/data/staff-reports";
import { countWaitingShops } from "@/lib/data/staff-shops";
import { TAB } from "@/lib/motion";
import { barFor, ROLE_PILLS, type BarKind } from "@/lib/nav/bar";
import { sellerNeeds } from "@/lib/selling/home";
import { queueFor } from "@/lib/selling/queue";
import { forYouTotal, messagesTotal, othersTotal } from "@/lib/you/model";
import { readForYou } from "@/lib/you/read";

/** The id of the words that describe the Saved tab (its count). */
const SAVED_COUNT_ID = "tab-saved-count";

/**
 * The phone tab bar (spec section 6.2, role bars spec 3): five tabs fixed to the bottom of the screen below the tablet
 * step and always visible, so the main places are one thumb's tap away while the header is hidden. Home, Shop and You
 * never move: Home and Shop are static here, and You is always slot 5 of the tail the layout passes, RoleTabs in
 * <Suspense> whose fallback is the student's StudentTail, so the static shell is the same for everyone. Rendered on the server: the only client code is NavLink (already in
 * the header's chunk) and Saved's count.
 *
 * Only Home and Sell prefetch, as the header already does; the others would cost their route's chunk on every page on
 * mobile data (decision 53).
 */
export function TabBar({ tail }: { tail: ReactNode }) {
  return (
    <nav aria-label="Main" className="tabbar">
      <ul>
        <li>
          <Tab href="/" icon={<HomeIcon />} label="Home" />
        </li>
        <li>
          <Tab href="/browse" icon={<BagIcon />} label="Shop" match="section" prefetch={false} />
        </li>
        {tail}
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
    <NavLink
      href={href}
      match={match}
      prefetch={prefetch}
      className={className}
      aria-describedby={describedBy}
      transitionTypes={TAB}
    >
      <span className="tab-icon">{icon}</span>
      <span className="tab-label">{label}</span>
      {children}
    </NavLink>
  );
}

/**
 * A tab's red badge (role bars spec 7): hidden from the tab's name (the tab has no aria-label), still read as its
 * description through the tab's aria-describedby. Counts over 99 show "99+".
 */
function TabBadge({ id, count, words }: { id: string; count: number; words: string }) {
  return (
    <span id={id} className="hdr-badge hdr-badge-alert" aria-hidden="true">
      {count > 99 ? "99+" : count} <span className="sr-only">{words}</span>
    </span>
  );
}

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * You (/account) when signed in, with a red badge that counts For you (role views spec 4.3): the sum of the rows the
 * You page lists, from the same reader, so the two always agree. Beside a Messages tab it leaves out the message rows
 * and says "other things" (`others`, role bars spec 7). It describes the tab ("3 things for you") without changing its
 * name. Sign-in when signed out, never the gated page itself (CLAUDE.md).
 */
export function AccountTab({
  signedIn,
  forYou = 0,
  others = false,
}: {
  signedIn: boolean;
  forYou?: number;
  others?: boolean;
}) {
  const badge = signedIn && forYou > 0;
  return (
    <Tab
      href={signedIn ? "/account" : "/login"}
      icon={<UserIcon />}
      label="You"
      match="section"
      prefetch={false}
      describedBy={badge ? "tab-account-new" : undefined}
    >
      {badge && (
        <TabBadge
          id="tab-account-new"
          count={forYou}
          words={`${others ? "other " : ""}${plural(forYou, "thing", "things")} for you`}
        />
      )}
    </Tab>
  );
}

/** The student's (and signed-out visitor's) last three tabs: Sell, Saved and You. The layout's static shell. */
export function StudentTail({ account = <AccountTab signedIn={false} /> }: { account?: ReactNode }) {
  return (
    <>
      <li>
        <Tab href="/sell" icon={<PlusIcon />} label="Sell" match="section" className="tab tab-sell" />
      </li>
      <li>
        <Tab href="/saved" icon={<HeartIcon />} label="Saved" prefetch={false} describedBy={SAVED_COUNT_ID}>
          <SavedCount id={SAVED_COUNT_ID} />
        </Tab>
      </li>
      <li>{account}</li>
    </>
  );
}

const PILL_ICONS: Record<Exclude<BarKind, "student">, ReactNode> = {
  seller: <StoreIcon />,
  mentor: <UserIcon />,
  admin: <GridIcon />,
};

const orNull = (count: Promise<number>) => count.catch(() => null);

/**
 * The pill's badge (role bars spec 7), from the reader of the list it opens: My shop counts Needs you (none while the
 * shop is pending, which has no link yet), Mentoring the slot requests waiting, Today everything waiting. A failed
 * read is null: no badge, never a guess.
 */
async function pillBadge(
  kind: Exclude<BarKind, "student">,
  sellerSlug: string | null,
): Promise<{ count: number; words: string } | null> {
  if (kind === "seller") {
    if (!sellerSlug) return null;
    await connection();
    const now = new Date();
    const count = await queueFor(sellerSlug).then(
      (queue) => sellerNeeds(queue, now).reduce((sum, need) => sum + need.count, 0),
      () => null,
    );
    return count === null ? null : { count, words: plural(count, "thing needs you", "things need you") };
  }
  if (kind === "mentor") {
    const slots = await orNull(openBookingCount());
    return slots === null
      ? null
      : { count: slots, words: plural(slots, "slot request waiting", "slot requests waiting") };
  }
  const [shops, reports, slots] = await Promise.all([
    orNull(countWaitingShops()),
    orNull(openReportCount()),
    orNull(openBookingCount()),
  ]);
  if (shops === null || reports === null || slots === null) return null;
  return { count: shops + reports + slots, words: "waiting" };
}

/**
 * The last three tabs for this request's session (role bars spec 3). Request-time, so the layout puts it inside
 * <Suspense>. A seller's or staff member's bar swaps Sell for their pill and Saved for Messages; a new message then
 * counts once, under Messages, and You counts the rest.
 */
export async function RoleTabs() {
  // As the header's icon: a failed lookup counts as signed out, a failed count shows no badge, never a guess (spec 4.2).
  // getViewer is one lookup per render (React's cache), shared with the header; readForYou is one read per request,
  // shared with the header's icon and the You page.
  const account = await getViewer().catch(() => null);
  if (!account) return <StudentTail />;
  const kind = barFor(account);
  // The two reads together: the pill's count doesn't wait on For you.
  const [items, badge] = await Promise.all([
    readForYou(account.id).then((read) => read.items, () => []),
    kind === "student" ? null : pillBadge(kind, account.seller?.sellerSlug ?? null),
  ]);
  if (kind === "student") return <StudentTail account={<AccountTab signedIn forYou={forYouTotal(items)} />} />;
  const pill = ROLE_PILLS[kind];
  const pillShows = badge !== null && badge.count > 0;
  const messages = messagesTotal(items);
  return (
    <>
      <li>
        <Tab
          href={pill.href}
          icon={PILL_ICONS[kind]}
          label={pill.label}
          match="section"
          prefetch={false}
          className="tab tab-sell"
          describedBy={pillShows ? "tab-pill-count" : undefined}
        >
          {pillShows && <TabBadge id="tab-pill-count" count={badge.count} words={badge.words} />}
        </Tab>
      </li>
      <li>
        <Tab
          href="/messages"
          icon={<MessageIcon />}
          label="Messages"
          match="section"
          prefetch={false}
          describedBy={messages > 0 ? "tab-messages-new" : undefined}
        >
          {messages > 0 && (
            <TabBadge id="tab-messages-new" count={messages} words={plural(messages, "new message", "new messages")} />
          )}
        </Tab>
      </li>
      <li>
        <AccountTab signedIn forYou={othersTotal(items)} others />
      </li>
    </>
  );
}
