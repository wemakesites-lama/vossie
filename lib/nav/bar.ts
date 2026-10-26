import { ADMIN_PATH, MENTOR_PATH } from "@/lib/staff/paths";
import { canUse } from "@/lib/staff/roles";
import type { Account } from "@/lib/types";

// Which main bar an account gets on phones (role bars spec 4, decision 92). The only place that decides: the tab bar
// and the header's phone heart both ask it. The highest role wins: admin, then mentor, then seller, then student.

export type BarKind = "student" | "seller" | "mentor" | "admin";

/** Signed out is "student". A shop in any state, pending and declined included, makes a seller: /sell is their home. */
export function barFor(account: Pick<Account, "roles" | "seller"> | null): BarKind {
  if (!account) return "student";
  if (canUse(account, "admin")) return "admin";
  if (canUse(account, "mentor")) return "mentor";
  return account.seller ? "seller" : "student";
}

/** The centre pill for each bar but the student one (whose pill is Sell): the role's workspace. */
export const ROLE_PILLS: Readonly<Record<Exclude<BarKind, "student">, { label: string; href: string }>> = {
  seller: { label: "My shop", href: "/sell" },
  mentor: { label: "Mentoring", href: MENTOR_PATH },
  admin: { label: "Today", href: ADMIN_PATH },
};
