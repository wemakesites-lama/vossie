import { createClient, type Session } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { dbEnv, removeAccounts, testAdminClient } from "@/tests/db/accounts";
import { renewalClient, type RenewalWrites } from "./renewal";

// Two requests renewing one session at the same moment (phase B's open point): a page and its prefetches, or two tabs,
// arriving while the access token is about to end. Supabase rotates refresh tokens, and a second use of a used one
// outside refresh_token_reuse_interval (10 seconds, supabase/config.toml) counts as theft and ends the whole session.
// Inside it, both renewals must succeed and leave a session that renews again.

const admin = testAdminClient();
const made: string[] = [];

/** A real session for a new account, as the sign-in client would store it. */
async function newSession(): Promise<Session> {
  const email = `db-renew-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@vossie.test`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createError) throw createError;
  made.push(created.user.id);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const { url, publishable } = dbEnv();
  const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (error || !data.session) throw error ?? new Error("no session");
  return data.session;
}

/** The vossie_auth cookie @supabase/ssr would write for `session`, marked as ending in 30 seconds so it renews. */
function endingSoon(session: Session): string {
  const soon = { ...session, expires_at: Math.floor(Date.now() / 1000) + 30, expires_in: 30 };
  return `vossie_auth=base64-${Buffer.from(JSON.stringify(soon)).toString("base64url")}`;
}

/** One proxy renewal of `cookie`: whether it's still signed in, and the session it wrote. */
async function renew(cookie: string): Promise<{ signedIn: boolean; session: Session | null }> {
  let writes: RenewalWrites | null = null;
  const request = new NextRequest("http://localhost:3000/account", { headers: { cookie } });
  const { signedIn } = await renewalClient(request, (w) => {
    writes = w;
  }).renew();
  const written = (writes as RenewalWrites | null)?.cookies.find(({ name, options }) => name === "vossie_auth" && options.maxAge !== 0);
  const session = written ? (JSON.parse(Buffer.from(written.value.replace(/^base64-/, ""), "base64url").toString()) as Session) : null;
  return { signedIn, session };
}

afterAll(async () => {
  await removeAccounts(admin, made);
});

describe("two renewals of one session at the same moment (phase B's open point)", () => {
  it("both renew, and each new session renews again: nothing is taken for a stolen token", async () => {
    const session = await newSession();
    const cookie = endingSoon(session);

    const [first, second] = await Promise.all([renew(cookie), renew(cookie)]);
    expect(first.signedIn).toBe(true);
    expect(second.signedIn).toBe(true);
    expect(first.session?.refresh_token).toBeTruthy();
    expect(second.session?.refresh_token).toBeTruthy();
    expect(first.session?.refresh_token).not.toBe(session.refresh_token);
    expect(second.session?.refresh_token).not.toBe(session.refresh_token);

    // Whichever cookie the browser keeps last, its session goes on renewing.
    for (const kept of [first.session!, second.session!]) {
      const again = await renew(endingSoon(kept));
      expect(again.signedIn).toBe(true);
      expect(again.session?.refresh_token).toBeTruthy();
    }
  });
});
