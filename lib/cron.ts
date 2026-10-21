import { timingSafeEqual } from "node:crypto";

// Vercel Cron's check (C2/C3 plan decision 15). When the project has CRON_SECRET, Vercel sends each cron call with
// "Authorization: Bearer <CRON_SECRET>". A cron Route Handler allows a call only with exactly that header, compared in
// constant time, and only while the secret is long enough to be one: unset, blank or short, every call is refused. The
// caller reads process.env.CRON_SECRET on each call, never at module scope.

/** The shortest CRON_SECRET the routes accept. */
export const CRON_SECRET_MIN = 32;

/** Whether `header` (the request's Authorization) is exactly "Bearer <secret>", for a secret of 32 characters or more. */
export function cronAllowed(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < CRON_SECRET_MIN || header === null) return false;
  const given = Buffer.from(header, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
