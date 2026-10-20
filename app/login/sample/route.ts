import { connection } from "next/server";
import { isSameOrigin, notFromVossie, seeOther } from "@/lib/auth/same-origin";
import { finishSample } from "@/lib/auth/sign-in-finish";

/**
 * A sample account's button (accounts spec 2.8).
 * A plain form post, answered with 303, so the browser loads where it leads as a new document: a page Next kept from
 * before signing in can't replay its redirect to sign-in (stage K spec decision 2). The Origin is checked before
 * anything is read (spec decision 3).
 * It matters most here: the button needs no cookie, so without it another site could sign a visitor in as a sample
 * account (login CSRF).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return notFromVossie();
  // A malformed body (bad content type) is answered with a 303 back to sign-in, not a 500 (plan amendment 9).
  const data = await request.formData().catch(() => null);
  if (!data) return seeOther("/login");
  return seeOther(await finishSample(data, new Date()));
}

/** Nothing to do on a GET: back to sign-in. Request-time, so the 303 is never a prerendered file (plan decision 10). */
export async function GET(): Promise<Response> {
  await connection();
  return seeOther("/login");
}
