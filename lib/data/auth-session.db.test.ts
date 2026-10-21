import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { dbEnv, removeAccounts, testAdminClient } from "@/tests/db/accounts";
import { sendSignInCode, verifySignInCode } from "./auth-session";

// Sign-in's calls to Supabase Auth on the local stack (Supabase phase B, Task 11): the domain hook's refusal, the code
// email, and checking a code. Next's cookies are a plain map here, as a Route Handler's would be. The codes are read
// from Mailpit, the local stack's mailbox. The addresses are new each run, and deleted after.

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string, options: { maxAge?: number } = {}) => {
      if (options.maxAge === 0) jar.delete(name);
      else jar.set(name, value);
    },
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => ({ get: () => null }),
}));

const MAILPIT = "http://127.0.0.1:55324";
const admin = testAdminClient();
const made: string[] = [];
const address = (what: string) => `db-${what}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@vossie.test`;

type MailpitMessage = { ID: string; Created: string; Subject: string };

/** The newest message to `to` since `after`, polled for up to 10 seconds, or null. */
async function newestMessage(to: string, after: Date, wait = 10_000): Promise<{ Subject: string; Text: string; HTML: string } | null> {
  const until = Date.now() + wait;
  while (Date.now() < until) {
    const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await search.json()) as { messages: MailpitMessage[] };
    const found = messages.find((message) => Date.parse(message.Created) >= after.getTime() - 1_000);
    if (found) return (await fetch(`${MAILPIT}/api/v1/message/${found.ID}`)).json();
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

async function userIdFor(email: string): Promise<string | null> {
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  return data.users.find((user) => user.email === email)?.id ?? null;
}

beforeEach(() => jar.clear());

afterAll(async () => {
  const ids = (await Promise.all(made.map(userIdFor))).filter((id): id is string => id !== null);
  await removeAccounts(admin, ids);
});

describe("sending and checking a code on the local stack (phase B, Task 11)", () => {
  it("is refused by the domain hook for an address outside the allowed domains, and nothing is sent", async () => {
    const email = `db-${Date.now().toString(36)}@gmail.com`;
    const before = new Date();
    expect(await sendSignInCode(email)).toBe("refused");
    expect(await newestMessage(email, before, 2_000)).toBeNull();
    expect(await userIdFor(email)).toBeNull();
  });

  it("emails the 6-digit code in the template's large line, and the right code signs in with the session in the cookie", async () => {
    const email = address("code");
    made.push(email);
    const before = new Date();
    expect(await sendSignInCode(email)).toBe("sent");
    const message = await newestMessage(email, before);
    expect(message?.Subject).toBe("Your CampusCart sign-in code");
    const code = /\b(\d{6})\b/.exec(message!.Text)![1];
    // The code stands on its own large line in the HTML template (supabase/templates/sign-in-code.html).
    expect(message!.HTML).toMatch(new RegExp(`>\\s*${code}\\s*<`));

    expect(await verifySignInCode(email, code === "000000" ? "111111" : "000000")).toBe("wrong");
    expect([...jar.keys()]).toEqual([]);
    const verified = await verifySignInCode(email, code);
    expect(verified).toEqual({ ok: true, userId: await userIdFor(email) });
    expect([...jar.keys()].every((name) => /^vossie_auth(\.\d+)?$/.test(name))).toBe(true);
    expect(jar.size).toBeGreaterThan(0);
  });

  it("gives no session to a password sign-up, which the app never offers (phase A's guard)", async () => {
    const email = address("password");
    made.push(email);
    const { url, publishable } = dbEnv();
    const client = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data } = await client.auth.signUp({ email, password: "a-long-password-1234" });
    expect(data.session).toBeNull();
  });
});
