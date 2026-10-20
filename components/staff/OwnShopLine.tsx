import Link from "next/link";
import { ADMIN_STAFF_PATH } from "@/lib/staff/paths";

/**
 * What an admin reads on their own shop's review page and its confirm pages, in place of the controls (stage L spec
 * decisions 4 and 6). The only admin is told how to hand the shop on: the link stands on its own line, so it's 44px
 * tall with the frame's existing pill class (plan decision 7). The words are samples for Lama to change.
 */
export function OwnShopLine({ onlyAdmin }: { onlyAdmin: boolean }) {
  return (
    <>
      <p>
        This is your own shop, so another admin must make the Hub&apos;s decisions about it: approving, verifying,
        pausing, pinning and choosing its mentor.
      </p>
      {onlyAdmin && (
        <>
          <p>You&apos;re the only admin. Give someone else the Admin role in Staff first.</p>
          <p>
            <Link href={ADMIN_STAFF_PATH} prefetch={false} className="staff-row-action">
              Staff
            </Link>
          </p>
        </>
      )}
    </>
  );
}
