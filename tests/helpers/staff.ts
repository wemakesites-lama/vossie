import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { hashToken } from "@/lib/auth/secrets";
import { createSession } from "@/lib/data/sessions";
import type { FakeRequest } from "./next-request";

// Shared by the staff tools' unit tests (staff tools plan, Task 9), with tests/helpers/next-request.ts.

/** When the staff tools' tests run: a Wednesday morning in October 2026, 10:42 in South Africa. */
export const STAFF_NOW = new Date("2026-10-14T08:42:00.000Z");

/** The browser signs in as `accountId`: a stored session for 30 days, and its token in the cookie. */
export async function signedInAs(request: FakeRequest, accountId: string): Promise<void> {
  const token = `token-${accountId}`;
  await createSession({
    key: hashToken(token),
    accountId,
    createdAt: STAFF_NOW,
    expiresAt: new Date(STAFF_NOW.getTime() + 30 * 24 * 60 * 60 * 1000),
  });
  request.cookies.set(SESSION_COOKIE, token);
}

/** A form's fields as the browser posts them: a list posts its field once per value. */
export function form(fields: Readonly<Record<string, string | readonly string[] | File>>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const item of typeof value === "string" || value instanceof File ? [value] : value) data.append(name, item);
  }
  return data;
}
