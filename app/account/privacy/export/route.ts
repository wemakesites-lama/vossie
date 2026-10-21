import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { exportAccountData } from "@/lib/data/accounts";
import { signInHref } from "@/lib/next-path";

/**
 * "Download your data" (accounts spec 3.3, plan decision 20): the signed-in account's data as campuscart-data.json. It
 * reads the session, so it runs per request, and it tells browsers and hosts not to keep a copy. A signed-out visitor
 * is sent to sign in first.
 */
export async function GET(): Promise<Response> {
  const account = await getViewer();
  if (!account) redirect(signInHref("/account/privacy"));
  const data = await exportAccountData(account.id, new Date());
  if (!data) redirect(signInHref("/account/privacy"));
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="campuscart-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
