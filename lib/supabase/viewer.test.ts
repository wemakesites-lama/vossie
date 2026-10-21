import { beforeEach, describe, expect, it, vi } from "vitest";
import { tokenClient } from "./viewer";

// The viewer's token client (phase B, amendment 3): the publishable key and the verified access token as a bearer, so
// the access rules know who is asking; nothing kept, nothing refreshed, no cookies written.

vi.mock("server-only", () => ({}));

const calls = vi.hoisted(() => ({ createClient: vi.fn(() => ({ client: true })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: calls.createClient }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}), headers: async () => new Headers() }));

beforeEach(() => {
  calls.createClient.mockClear();
  vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:55321");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_TESTVALUEtestvalue");
});

describe("tokenClient (phase B)", () => {
  it("uses the publishable key and the access token, and keeps or refreshes nothing", () => {
    expect(tokenClient("eyJ.access.token")).toEqual({ client: true });
    expect(calls.createClient).toHaveBeenCalledWith("http://127.0.0.1:55321", "sb_publishable_TESTVALUEtestvalue", {
      global: { headers: { Authorization: "Bearer eyJ.access.token" } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
});
