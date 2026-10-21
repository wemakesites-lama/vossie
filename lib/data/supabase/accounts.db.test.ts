import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from "vitest";
import { deleteAccountData } from "@/lib/data/accounts";
import { clearSessionFormStates, getFormState, saveFormState } from "@/lib/data/form-states";
import { listSessions } from "@/lib/data/sessions";
import type { Database } from "@/lib/supabase/database.types";
import { dbEnv, testAdminClient } from "@/tests/db/accounts";
import { setViewer } from "@/tests/db/viewer";

// Accounts, sessions and form states on the local stack (phase B, Task 4; decision 8, amendments 7 and 8), through
// lib/data with VOSSIE_BACKEND=supabase. The viewer is the db harness's minted session (forViewer replaced by the seam),
// and currentClaims() is that session's claims, since these tests have no request cookies.

vi.mock("@/lib/data/supabase/clients", async (original) => (await import("@/tests/db/viewer")).withViewerSeam(await original()));
const claims = vi.hoisted(() => ({ current: null as null | { userId: string; sessionId: string; email: string } }));
vi.mock("@/lib/data/supabase/auth-session", async (original) => ({
  ...(await original<object>()),
  currentClaims: async () => claims.current,
}));

const admin = testAdminClient();

/** The claims in an access token (the db harness's own, from verifyOtp), read without checking: the stack issued it. */
function claimsOf(accessToken: string) {
  const payload = JSON.parse(Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8")) as Record<string, string>;
  return { userId: payload.sub, sessionId: payload.session_id, email: payload.email };
}

/** A fresh Auth user and a real session for it, as the harness mints one (no email). */
async function signedInUser(email: string): Promise<{ id: string; accessToken: string }> {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(created.error.message);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(link.error.message);
  const { url, publishable } = dbEnv();
  const signIn = createClient<Database>(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
  const verified = await signIn.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  if (verified.error || !verified.data.session) throw new Error(verified.error?.message ?? "no session");
  return { id: created.data.user.id, accessToken: verified.data.session.access_token };
}

describe("the data download's sessions (decision 3)", () => {
  let user: { id: string; accessToken: string };
  beforeAll(async () => {
    user = await signedInUser(`phase-b-sessions-${Date.now()}@vossie.test`);
  });
  afterAll(async () => {
    await admin.auth.admin.deleteUser(user.id);
  });

  it("lists the one session, ending 30 days after its last refresh, with no id", async () => {
    const [session, ...others] = await listSessions(user.id);
    expect(others).toEqual([]);
    expect(session.key).toBe("");
    expect(session.accountId).toBe(user.id);
    const days = (Date.parse(session.expiresAt) - Date.parse(session.createdAt)) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThan(30.01);
    expect(Math.abs(Date.parse(session.createdAt) - Date.now())).toBeLessThan(5 * 60_000);
  });
});

describe("form states, the viewer's own (amendment 8)", () => {
  afterEach(async () => {
    setViewer(null);
    claims.current = null;
    await admin.from("form_states").delete().eq("account_id", inject("dbSessions").shopper.id);
  });

  it("saves, reads and clears a session's states, leaving a taken token to run out", async () => {
    const { id, accessToken } = inject("dbSessions").shopper;
    setViewer("shopper");
    claims.current = claimsOf(accessToken);
    const sessionId = claims.current.sessionId;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    await saveFormState({ sessionKey: sessionId, form: "details", errors: ["campus-missing"], values: { firstName: "S" }, notice: null, expiresAt }, now);
    expect(await getFormState(sessionId, "details", now)).toEqual({
      key: `${sessionId}:details`,
      sessionKey: sessionId,
      form: "details",
      errors: ["campus-missing"],
      values: { firstName: "S" },
      notice: null,
      expiresAt,
    });
    const taken = await admin
      .from("form_states")
      .insert({ session_id: sessionId, form: "staff-once:test", account_id: id, expires_at: expiresAt, taken: true });
    if (taken.error) throw new Error(taken.error.message);

    await clearSessionFormStates(sessionId);
    const left = await admin.from("form_states").select("form, taken").eq("session_id", sessionId);
    expect(left.data).toEqual([{ form: "staff-once:test", taken: true }]);
  });
});

describe("deleting an account (decision 8)", () => {
  const stamp = Date.now().toString(36);
  const listingId = `pbdel-${stamp}`.slice(0, 20);
  let leaving: string;
  let shopId: string;
  let conversationId: string;

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({ email: `phase-b-leaving-${stamp}@vossie.test`, email_confirm: true });
    if (created.error) throw new Error(created.error.message);
    leaving = created.data.user.id;
    const steps = [
      () => admin.from("profiles").insert({ id: leaving, first_name: "Leaving", campus_slug: "pretoria" }),
      async () => {
        const shop = await admin
          .from("shops")
          .insert({ slug: `leaving-${stamp}`, owner_id: leaving, name: `Leaving ${stamp}`, category_slug: "tech", campus_slug: "pretoria", since: "2026-10" })
          .select("id")
          .single();
        if (shop.data) shopId = shop.data.id;
        return shop;
      },
      () => admin.from("seller_profiles").insert({ account_id: leaving, status: "approved", shop_id: shopId, approved_at: new Date().toISOString() }),
      () =>
        admin.from("listings").insert({
          id: listingId,
          shop_id: shopId,
          state: "available",
          kind: "item",
          title: "A phase B test listing",
          category_slug: "tech",
          condition: "good",
          price_zar: 100,
          pay_mode: "cash",
          description: "Made by the phase B deletion test.",
          handover: "online",
          campus_slug: "pretoria",
          first_published_at: new Date().toISOString(),
        }),
      async () => {
        const conversation = await admin
          .from("conversations")
          .insert({ listing_id: listingId, listing_title: "A phase B test listing", shop_id: shopId, buyer_id: inject("dbSessions").shopper.id })
          .select("id")
          .single();
        if (conversation.data) conversationId = conversation.data.id;
        return conversation;
      },
      () => admin.from("messages").insert({ conversation_id: conversationId, side: "buyer", body: "Is it still available?" }),
    ];
    for (const step of steps) {
      const { error } = await step();
      if (error) throw new Error(error.message);
    }
  });

  afterAll(async () => {
    if (conversationId) await admin.from("conversations").delete().eq("id", conversationId);
    await admin.auth.admin.deleteUser(leaving).catch(() => {});
  });

  it("removes the profile, shop, listing and Auth user, and keeps the other person's conversation", async () => {
    await deleteAccountData(leaving);
    const [profile, shop, listing, user, conversation] = await Promise.all([
      admin.from("profiles").select("id").eq("id", leaving),
      admin.from("shops").select("id").eq("id", shopId),
      admin.from("listings").select("id").eq("id", listingId),
      admin.auth.admin.getUserById(leaving),
      admin.from("conversations").select("id, buyer_id, seller_gone").eq("id", conversationId),
    ]);
    expect(profile.data).toEqual([]);
    expect(shop.data).toEqual([]);
    expect(listing.data).toEqual([]);
    expect(user.data.user).toBeNull();
    expect(conversation.data).toEqual([{ id: conversationId, buyer_id: inject("dbSessions").shopper.id, seller_gone: true }]);
  });
});
