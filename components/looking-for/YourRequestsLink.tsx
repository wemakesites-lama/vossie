import Link from "next/link";
import { getViewer } from "@/lib/auth/session";
import { countOpenRequests } from "@/lib/data/requests";
import { YOUR_REQUESTS_PATH } from "@/lib/looking-for/paths";

/**
 * "Your requests (N open)" beside Post a request (role views spec 7.4, plan decision 16), for a signed-in student with
 * an open request. Request-time: the board gives it a <Suspense> of its own with nothing as the fallback; the button
 * holds the row's height, so nothing moves when it arrives. A failed read shows nothing. No prefetch (decision 53).
 */
export async function YourRequestsLink() {
  const account = await getViewer().catch(() => null);
  if (!account) return null;
  // getViewer awaited connection() before it found the account, so the clock can be read (decision 26). The count
  // settles first, as Your requests does (stage L).
  const open = await countOpenRequests(account.id, new Date()).catch(() => 0);
  if (open === 0) return null;
  return (
    <Link href={YOUR_REQUESTS_PATH} prefetch={false} className="board-yours">
      {`Your requests (${open} open)`}
    </Link>
  );
}
