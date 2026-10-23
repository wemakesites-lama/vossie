import type { ReactNode } from "react";
import { SectionError } from "@/components/home/SectionError";
import {
  AlertIcon,
  CalendarIcon,
  FlagIcon,
  GridIcon,
  HeartIcon,
  InfoIcon,
  MapPinIcon,
  MessageIcon,
  SearchIcon,
  ShieldIcon,
  StoreIcon,
  UserIcon,
} from "@/components/icons";
import { Banner } from "@/components/kit/Banner";
import { Card } from "@/components/kit/Card";
import { ListRow } from "@/components/kit/ListRow";
import { NeedsYouList } from "@/components/kit/NeedsYouList";
import { SIGN_OUT_PATH } from "@/lib/auth/post-paths";
import { savedTabPath } from "@/lib/following/rules";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";
import { AREA_HOME } from "@/lib/staff/paths";
import { staffAreasOf } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";
import {
  ALL_CLEAR,
  bookingsRow,
  closingSoonText,
  requestsDetail,
  savedDetail,
  searchesDetail,
  shopDetail,
  type ForYou,
  type YourStuff,
} from "@/lib/you/model";
import { DETAILS_PATH, YOU_PATH } from "@/lib/you/paths";

const icon = (node: ReactNode) => ({ kind: "icon" as const, icon: node });

type YouViewProps = {
  account: Account;
  campusName: string;
  /** Null when its read failed: the card says so (role views spec 8). */
  forYou: ForYou | null;
  stuff: YourStuff | null;
};

/**
 * You (role views spec 7.4): the greeting, For you, a banner when a request closes soon, Your stuff and Settings, in
 * one column of kit cards. Every row is a ListRow, which never prefetches (decision 53; staff pages read the session).
 * A failed reader shows its card's error and leaves the rest working.
 */
export function YouView({ account, campusName, forYou, stuff }: YouViewProps) {
  return (
    <div className="you-body">
      <header className="you-head">
        {/* One text node, so "Hi, Thandi" is one string in the document (plan decision 13). */}
        <h1 className="account-title">{`Hi, ${account.firstName}`}</h1>
        <p className="you-campus">
          <MapPinIcon /> {campusName}
        </p>
      </header>

      <div id="you-for-you">
        <Card title="For you">
          {forYou ? (
            <NeedsYouList label="For you" items={forYou.items} allClear={ALL_CLEAR} />
          ) : (
            <SectionError id="you-for-you" title="For you" path={YOU_PATH} />
          )}
        </Card>
      </div>

      {stuff?.closingSoon && (
        <Banner tone="warning" icon={<AlertIcon />} action={{ label: "Your requests", href: YOUR_REQUESTS_PATH }}>
          {closingSoonText(stuff.closingSoon)}
        </Banner>
      )}

      <div id="you-stuff">
        <Card title="Your stuff">
          <ul className="you-rows">
            <ListRow
              href="/messages"
              lead={icon(<MessageIcon />)}
              title="Messages"
              detail={forYou && forYou.conversations > 0 ? `${forYou.conversations} unread` : undefined}
            />
            <ListRow
              href="/notifications"
              lead={icon(<InfoIcon />)}
              title="Notifications"
              detail={forYou && forYou.newNotifications > 0 ? `${forYou.newNotifications} new` : undefined}
            />
            {stuff ? (
              <StuffRows stuff={stuff} />
            ) : (
              <li className="you-rows-error">
                <SectionError id="you-stuff" title="Your saved things, requests and bookings" path={YOU_PATH} />
              </li>
            )}
            {account.seller && (
              <ListRow href="/sell" lead={icon(<StoreIcon />)} title="Your shop" detail={shopDetail(account.seller)} />
            )}
            {staffAreasOf(account).map((area) => (
              <ListRow key={area} href={AREA_HOME[area].href} lead={icon(<GridIcon />)} title={AREA_HOME[area].label} />
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Settings">
        <ul className="you-rows">
          <ListRow href={DETAILS_PATH} lead={icon(<UserIcon />)} title="Your details" detail="Your name and campus" />
          <ListRow
            href="/account/privacy"
            lead={icon(<ShieldIcon />)}
            title="Privacy"
            detail="Your data, and deleting your account"
          />
        </ul>
        <form action={SIGN_OUT_PATH} method="post" className="you-signout">
          <button type="submit" className="btn btn-outline text-navy">
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}

/** The rows that come from readYourStuff. */
function StuffRows({ stuff }: { stuff: YourStuff }) {
  const bookings = bookingsRow(stuff.bookings);
  return (
    <>
      <ListRow href="/saved" lead={icon(<HeartIcon />)} title="Saved" detail={savedDetail(stuff)} />
      <ListRow
        href={YOUR_REQUESTS_PATH}
        lead={icon(<FlagIcon />)}
        title="Your requests"
        detail={requestsDetail(stuff.requests)}
      />
      <ListRow
        href={savedTabPath("searches")}
        lead={icon(<SearchIcon />)}
        title="Saved searches"
        detail={searchesDetail(stuff.searches)}
      />
      <ListRow href={bookings.href} lead={icon(<CalendarIcon />)} title="Hub bookings" detail={bookings.detail} />
    </>
  );
}
