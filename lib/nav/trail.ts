import type { StaffRole } from "@/lib/types";

// The breadcrumb trail (wayfinding spec 3.2): one map of which page sits above which. Pages pass their own route, the
// values of its dynamic segments and the names only they know (a listing's title, a shop's name); nothing works out a
// parent from the address. A test reads app/ and fails for a page that is neither here nor top-level.

export type Crumb = { label: string; href: string | null };

/** The places the tab bars open: no trail, they are where a trail starts. */
export const TOP_LEVEL: ReadonlySet<string> = new Set([
  "/",
  "/browse",
  "/saved",
  "/messages",
  "/account",
  "/hub",
  "/looking-for",
  "/sell",
  "/admin",
  "/login",
]);

/** Each route's parent route. `/hub/manage` and `/mentor` are role-aware (ROLE_PARENTS). */
export const PARENTS: Readonly<Record<string, string>> = {
  "/account/details": "/account",
  "/account/privacy": "/account",
  "/account/requests": "/account",
  "/notifications": "/account",

  "/collections/[slug]": "/",
  "/how-it-works": "/",
  "/privacy": "/",
  "/safety": "/",
  "/seller-guidelines": "/",
  "/terms": "/",
  "/trust": "/",
  "/report": "/",
  "/report/sent": "/",

  "/listings/[id]": "/browse",
  "/listings/[id]/message": "/listings/[id]",
  "/sellers/[slug]": "/browse",
  "/sellers/[slug]/message": "/sellers/[slug]",

  "/hub/[id]": "/hub",
  "/hub/[id]/book": "/hub/[id]",

  "/looking-for/new": "/looking-for",
  "/looking-for/[id]": "/looking-for",
  "/looking-for/[id]/edit": "/looking-for/[id]",
  "/looking-for/[id]/offer": "/looking-for/[id]",
  "/looking-for/[id]/delete": "/looking-for/[id]",

  "/messages/[id]": "/messages",

  "/sell/listings": "/sell",
  "/sell/profile": "/sell",
  "/sell/onboarding": "/sell",
  "/sell/listings/new": "/sell/listings",
  "/sell/listings/[id]/edit": "/sell/listings",
  "/sell/listings/[id]/delete": "/sell/listings",

  "/admin/sellers": "/admin",
  "/admin/reports": "/admin",
  "/admin/hidden": "/admin",
  "/admin/featured": "/admin",
  "/admin/pickup-points": "/admin",
  "/admin/numbers": "/admin",
  "/admin/staff": "/admin",
  "/admin/audit": "/admin",
  "/admin/more": "/admin",
  "/admin/sellers/[slug]": "/admin/sellers",
  "/admin/sellers/[slug]/decline": "/admin/sellers/[slug]",
  "/admin/sellers/[slug]/pause": "/admin/sellers/[slug]",
  "/admin/reports/[id]": "/admin/reports",
  "/admin/reports/[id]/hide": "/admin/reports/[id]",
  "/admin/reports/[id]/pause": "/admin/reports/[id]",
  "/admin/hidden/listings/[id]": "/admin/hidden",
  "/admin/hidden/requests/[id]": "/admin/hidden",
  "/admin/staff/[id]/remove-admin": "/admin/staff",
  "/admin/staff/[id]/remove-mentor": "/admin/staff",

  "/hub/new": "/hub/manage",
  "/hub/[id]/edit": "/hub/manage",
  "/mentor/[slug]": "/mentor",
};

/** Under the Hub console for an admin; a mentor has no console, so for them these are where the trail starts. */
const ROLE_PARENTS: Readonly<Record<string, string>> = {
  "/hub/manage": "/admin",
  "/mentor": "/admin",
};

/** Every route a page can name. */
export const TRAIL_ROUTES: ReadonlySet<string> = new Set([...TOP_LEVEL, ...Object.keys(PARENTS), ...Object.keys(ROLE_PARENTS)]);

/** Fixed routes' names, as their headings and the tab bars say them. Dynamic routes are named by their page. */
export const LABELS: Readonly<Record<string, string>> = {
  "/": "Home",
  "/browse": "Shop",
  "/saved": "Saved",
  "/messages": "Messages",
  "/account": "You",
  "/hub": "Hub",
  "/looking-for": "Looking For",
  "/sell": "Sell",
  "/login": "Sign in",

  "/account/details": "Your details",
  "/account/privacy": "Privacy settings",
  "/account/requests": "Your requests",
  "/notifications": "Notifications",
  "/how-it-works": "How CampusCart works",
  "/privacy": "Privacy policy",
  "/safety": "Safety",
  "/seller-guidelines": "Seller guidelines",
  "/terms": "Terms of use",
  "/trust": "How trust works",
  "/report": "Report",
  "/report/sent": "Report sent",
  "/listings/[id]/message": "Message the seller",
  "/sellers/[slug]/message": "Message the shop",
  "/hub/[id]/book": "Request a slot",
  "/looking-for/new": "Post a request",
  "/looking-for/[id]/edit": "Edit your request",
  "/looking-for/[id]/offer": "Offer to help",
  "/looking-for/[id]/delete": "Delete your request",
  "/sell/listings": "Your listings",
  "/sell/profile": "Edit your shop",
  "/sell/onboarding": "Set up your shop",
  "/sell/listings/new": "New listing",
  "/sell/listings/[id]/edit": "Edit your listing",
  "/sell/listings/[id]/delete": "Delete your listing",

  "/admin": "Hub console",
  "/admin/sellers": "Shops",
  "/admin/reports": "Reports",
  "/admin/hidden": "Hidden",
  "/admin/featured": "Featured",
  "/admin/pickup-points": "Pickup points",
  "/admin/numbers": "Last week",
  "/admin/staff": "Staff",
  "/admin/audit": "Audit log",
  "/admin/more": "More tools",
  "/admin/sellers/[slug]/decline": "Decline",
  "/admin/sellers/[slug]/pause": "Pause the shop",
  "/admin/reports/[id]/hide": "Hide it",
  "/admin/reports/[id]/pause": "Pause the shop",
  "/admin/hidden/listings/[id]": "Show the listing again",
  "/admin/hidden/requests/[id]": "Show the request again",
  "/admin/staff/[id]/remove-admin": "Remove the Admin role",
  "/admin/staff/[id]/remove-mentor": "Remove the Mentor role",
  "/hub/manage": "Posts and office hours",
  "/hub/new": "Write a post",
  "/hub/[id]/edit": "Edit the post",
  "/mentor": "Mentoring",
};

export type TrailOptions = {
  /** The dynamic segments' values: `{ id: "r-001" }` fills every `[id]` on the way up. */
  params?: Readonly<Record<string, string>>;
  /** Names for routes LABELS can't know, by route: `{ "/listings/[id]": "Casio fx-991ZA Plus calculator" }`. */
  names?: Readonly<Record<string, string>>;
  /** A different address for a crumb, by route: a selling thread's Messages is `/messages?tab=selling`. */
  hrefs?: Readonly<Record<string, string>>;
  /** For the role-aware routes: an admin's are under the Hub console. */
  roles?: readonly StaffRole[];
  /** A page whose parent isn't fixed (a report sits under what it reports): that crumb in place of PARENTS'. */
  parent?: Crumb & { href: string };
  /** Crumbs between the parent and the page: a listing's category, under Shop. The last becomes the back link. */
  between?: readonly (Crumb & { href: string })[];
};

function fill(route: string, params: Readonly<Record<string, string>>): string {
  return route.replace(/\[(\w+)\]/g, (whole, key: string) => (key in params ? encodeURIComponent(params[key]) : whole));
}

function parentOf(route: string, roles: readonly StaffRole[]): string | null {
  if (route in ROLE_PARENTS) return roles.includes("admin") ? ROLE_PARENTS[route] : null;
  return PARENTS[route] ?? null;
}

/**
 * The crumbs from Home down to `route`, the last one the page itself (no href). A top-level page, or a role-aware one
 * for a viewer without the admin role, gets an empty trail and shows none. An unknown route throws: the guard test
 * keeps every page in the map, so this only catches a typo.
 */
export function trailFor(route: string, options: TrailOptions = {}): Crumb[] {
  if (!TRAIL_ROUTES.has(route)) throw new Error(`No trail for ${route}: add it to lib/nav/trail.ts`);
  const { params = {}, names = {}, hrefs = {}, roles = [], between = [] } = options;
  const label = (at: string) => names[at] ?? LABELS[at] ?? at;
  const here: Crumb = { label: label(route), href: null };

  if (options.parent) return [{ label: LABELS["/"], href: "/" }, options.parent, ...between, here];
  if (TOP_LEVEL.has(route)) return [];

  const above: Crumb[] = [];
  for (let at = parentOf(route, roles); at !== null; at = parentOf(at, roles)) {
    above.unshift({ label: label(at), href: hrefs[at] ?? fill(at, params) });
    if (at === "/") break;
  }
  if (above.length === 0) return [];
  if (above[0].href !== "/") above.unshift({ label: LABELS["/"], href: "/" });
  return [...above, ...between, here];
}
