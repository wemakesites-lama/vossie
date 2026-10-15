import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { signInHref } from "@/lib/next-path";
import type { Account, StaffArea } from "@/lib/types";
import { canUse } from "./roles";

/**
 * The one gate for every staff page, Server Action and the CSV route (staff tools spec 2.1, plan decision 1): a
 * signed-out visitor goes to sign in and comes back to `nextPath`; anyone signed in without the role gets the 404,
 * not a "forbidden" page, so staff pages aren't advertised. Pages call it inside <Suspense>, after the page has
 * started streaming, so the visitor sees the site's 404 page (status 200, noindex); actions and the route call it
 * first.
 */
export async function requireStaff(area: StaffArea, nextPath: string): Promise<Account> {
  const account = await getViewer();
  if (!account) redirect(signInHref(nextPath));
  if (!canUse(account, area)) notFound();
  return account;
}

/**
 * A staff page's tab title (plan decision 1): its own for staff, "Page not found" for everyone else, so neither the
 * static shell nor the title names the page. Never indexed. It reads the session, so the title streams in with the
 * page's request-time parts.
 */
export async function staffMetadata(area: StaffArea, title: string): Promise<Metadata> {
  const account = await getViewer().catch(() => null);
  const robots = { index: false, follow: false };
  return canUse(account, area) ? { title, robots } : { title: "Page not found", robots };
}
