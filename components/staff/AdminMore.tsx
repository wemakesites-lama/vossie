import { ChartIcon, ClockIcon, FlagIcon, MapPinIcon, ShieldIcon, StoreIcon, TrendingIcon } from "@/components/icons";
import { ListRow } from "@/components/kit/ListRow";
import {
  ADMIN_AUDIT_PATH,
  ADMIN_FEATURED_PATH,
  ADMIN_HIDDEN_PATH,
  ADMIN_NUMBERS_PATH,
  ADMIN_POINTS_PATH,
  ADMIN_STAFF_PATH,
  MENTOR_PATH,
} from "@/lib/staff/paths";

/** The admin bar's More (role views spec 4.1): the sections the five tabs don't hold, as rows. */
export function AdminMore({ hidden }: { hidden: { listings: number; requests: number } }) {
  const total = hidden.listings + hidden.requests;
  return (
    <ul aria-label="More tools" className="kit-card">
      <ListRow
        href={ADMIN_HIDDEN_PATH}
        lead={{ kind: "icon", icon: <FlagIcon /> }}
        title="Hidden by the Hub"
        detail={total === 0 ? "Nothing hidden" : `${total} hidden now`}
      />
      <ListRow
        href={ADMIN_FEATURED_PATH}
        lead={{ kind: "icon", icon: <TrendingIcon /> }}
        title="Featured"
        detail="Pin sellers to a campus"
      />
      <ListRow
        href={ADMIN_POINTS_PATH}
        lead={{ kind: "icon", icon: <MapPinIcon /> }}
        title="Pickup points"
        detail="Each campus's meeting places"
      />
      <ListRow href={ADMIN_STAFF_PATH} lead={{ kind: "icon", icon: <ShieldIcon /> }} title="Staff accounts" detail="Who has a role" />
      <ListRow href={ADMIN_NUMBERS_PATH} lead={{ kind: "icon", icon: <ChartIcon /> }} title="Last week" detail="Every measure, by campus" />
      <ListRow href={ADMIN_AUDIT_PATH} lead={{ kind: "icon", icon: <ClockIcon /> }} title="Audit log" detail="Every staff action" />
      <ListRow href={MENTOR_PATH} lead={{ kind: "icon", icon: <StoreIcon /> }} title="Mentoring" detail="Shops you mentor" />
    </ul>
  );
}
