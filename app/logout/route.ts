import { connection } from "next/server";
import { setFlash } from "@/lib/auth/cookies";
import { isSameOrigin, notFromVossie, seeOther } from "@/lib/auth/same-origin";
import { endSession } from "@/lib/auth/session";

/**
 * Sign out (accounts spec 2.5; Lama, 2026-10-20). A plain form post, answered with 303 to the homepage, so the
 * browser loads it as a new document and drops every signed-in page Next was keeping hidden (stage K spec section 8).
 * The homepage's toast says so, as before (accounts plan decision 12).
 */
export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return notFromVossie();
  // A malformed body (bad content type) is answered with the same 303, not a 500 (plan amendment 9).
  const data = await request.formData().catch(() => null);
  if (!data) return seeOther("/");
  await endSession();
  await setFlash("signed-out");
  return seeOther("/");
}

/** A link or a typed address signs nobody out. Request-time, so the 303 is never a prerendered file (plan decision 10). */
export async function GET(): Promise<Response> {
  await connection();
  return seeOther("/");
}
