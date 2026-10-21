import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSampleStore } from "@/lib/data/store";
import { fakeSupabase } from "@/tests/helpers/fake-supabase";
import * as Sample from "../accounts";
import {
  completeProfile,
  createAccount,
  deleteAccountData,
  exportAccountData,
  findAccountByEmail,
  getAccount,
  getLatestConsent,
  getViewerAccount,
  hasProfile,
  recordConsent,
  restoreSampleAccount,
  updateAccountDetails,
} from "./accounts";

// Accounts on Supabase (phase B, Task 4; decisions 7 to 9; amendments 7 and 10). The viewer's own reads and actions go
// through forViewer(); deletion through the admin client.

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: () => {}, cacheLife: () => {}, updateTag: () => {}, revalidateTag: () => {}, refresh: () => {} }));
const seam = vi.hoisted(() => ({
  viewer: null as unknown,
  server: null as unknown,
  claims: null as null | { userId: string; sessionId: string; email: string },
  sessions: [] as { key: string; accountId: string; createdAt: string; expiresAt: string }[],
}));
vi.mock("./clients", () => ({ forViewer: async () => seam.viewer, forServer: () => seam.server }));
vi.mock("./auth-session", () => ({ currentClaims: async () => seam.claims }));
vi.mock("../sessions", () => ({ listSessions: async () => seam.sessions }));

const CLAIMS = { userId: "user-1", sessionId: "session-1", email: "thandi@vossie.net" };
const NOW = new Date("2026-10-21T10:00:00.000Z");
const PROFILE = { id: "user-1", first_name: "Thandi", campus_slug: "pretoria", roles: ["mentor"], created_at: "2026-10-01T08:00:00+00:00" };

let viewer: ReturnType<typeof fakeSupabase>;
let server: ReturnType<typeof fakeSupabase>;

beforeEach(() => {
  resetSampleStore();
  viewer = fakeSupabase();
  server = fakeSupabase();
  seam.viewer = viewer.client;
  seam.server = server.client;
  seam.claims = CLAIMS;
  seam.sessions = [];
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the viewer's account (decision 7)", () => {
  it("reads the profile, its roles and its open shop's link, with the address from the verified claims", async () => {
    viewer.answer("from:profiles", { data: PROFILE });
    viewer.answer("from:seller_profiles", { data: { status: "approved", shop_id: "shop-1" } });
    viewer.answer("from:shops", { data: { slug: "tech-corner" } });
    expect(await getViewerAccount(CLAIMS)).toEqual({
      id: "user-1",
      email: "thandi@vossie.net",
      firstName: "Thandi",
      campusSlug: "pretoria",
      roles: ["mentor"],
      seller: { status: "approved", sellerSlug: "tech-corner" },
      createdAt: "2026-10-01T08:00:00.000Z",
    });
    expect(viewer.chainOf("from", "profiles")).toEqual([
      ["from", "profiles"],
      ["select", "id, first_name, campus_slug, roles, created_at"],
      ["eq", "id", "user-1"],
      ["maybeSingle"],
    ]);
  });

  it("gives a waiting shop no link yet, as the sample store does", async () => {
    viewer.answer("from:profiles", { data: PROFILE });
    viewer.answer("from:seller_profiles", { data: { status: "pending", shop_id: "shop-1" } });
    expect((await getViewerAccount(CLAIMS))?.seller).toEqual({ status: "pending", sellerSlug: null });
    expect(viewer.calls.some((call) => call[0] === "from" && call[1] === "shops")).toBe(false);
  });

  it("is no account for a session with no profile (a student between steps 2 and 3)", async () => {
    expect(await getViewerAccount(CLAIMS)).toBeNull();
    expect(viewer.calls.some((call) => call[1] === "seller_profiles")).toBe(false);
  });

  it("says whether the signed-in account has a profile yet", async () => {
    viewer.answer("from:profiles", { data: { id: "user-1" } }, { data: null });
    expect(await hasProfile("user-1")).toBe(true);
    expect(await hasProfile("user-1")).toBe(false);
  });

  it("gives getAccount for the viewer's own id only; another account's is phase C's", async () => {
    viewer.answer("from:profiles", { data: PROFILE });
    expect((await getAccount("user-1"))?.firstName).toBe("Thandi");
    await expect(getAccount("someone-else")).rejects.toThrow("phase C");
    seam.claims = null;
    await expect(getAccount("user-1")).rejects.toThrow("phase C");
  });
});

describe("what Supabase Auth and complete_profile do instead", () => {
  it("never finds an account by address or makes one directly", async () => {
    await expect(findAccountByEmail("thandi@vossie.net")).rejects.toThrow("Supabase");
    await expect(createAccount({ email: "a@vossie.net", firstName: "A", campusSlug: "pretoria", now: NOW })).rejects.toThrow(
      "Supabase",
    );
    expect(await restoreSampleAccount("student@eduvos.com")).toBeNull();
  });

  it("finishes step 3 with complete_profile, which stamps consent itself (decision 9)", async () => {
    viewer.answer("rpc:complete_profile", { data: true });
    expect(
      await completeProfile({ email: "thandi@vossie.net", firstName: "Thandi", campusSlug: "pretoria", policyVersion: "2026-10-draft", now: NOW }),
    ).toBe(true);
    expect(viewer.calls).toEqual([
      ["rpc", "complete_profile", { p_first_name: "Thandi", p_campus_slug: "pretoria", p_policy_version: "2026-10-draft" }],
    ]);
  });

  it("records a returning sign-in's consent with record_consent, the database's clock (decision 9)", async () => {
    await recordConsent("user-1", "2026-10-draft", NOW);
    expect(viewer.calls).toEqual([["rpc", "record_consent", { p_policy_version: "2026-10-draft" }]]);
    await expect(recordConsent("someone-else", "2026-10-draft", NOW)).rejects.toThrow("signed-in account");
  });

  it("saves Edit details with update_profile, then reads the account back", async () => {
    viewer.answer("rpc:update_profile", { data: true });
    viewer.answer("from:profiles", { data: { ...PROFILE, first_name: "Thandeka" } });
    expect((await updateAccountDetails("user-1", { firstName: "Thandeka", campusSlug: "pretoria" }))?.firstName).toBe("Thandeka");
    expect(viewer.calls[0]).toEqual(["rpc", "update_profile", { p_first_name: "Thandeka", p_campus_slug: "pretoria" }]);
    viewer.answer("rpc:update_profile", { data: false });
    expect(await updateAccountDetails("user-1", { firstName: "T", campusSlug: "pretoria" })).toBeNull();
    await expect(updateAccountDetails("someone-else", { firstName: "T", campusSlug: "pretoria" })).rejects.toThrow("signed-in account");
  });

  it("reads the newest consent", async () => {
    viewer.answer("from:consents", { data: { version: "2026-10-draft", agreed_at: "2026-10-21T09:00:00+00:00" } }, { data: null });
    expect(await getLatestConsent("user-1")).toEqual({ version: "2026-10-draft", agreedAt: "2026-10-21T09:00:00.000Z" });
    expect(viewer.chainOf("from", "consents")).toEqual([
      ["from", "consents"],
      ["select", "version, agreed_at"],
      ["eq", "account_id", "user-1"],
      ["order", "agreed_at", { ascending: false }],
      ["limit", 1],
      ["maybeSingle"],
    ]);
    expect(await getLatestConsent("user-1")).toBeNull();
  });
});

describe("Download your data on Supabase", () => {
  it("takes the account, consents and sessions from Supabase, in the sample's key order, with no session id", async () => {
    viewer.answer("from:profiles", { data: PROFILE });
    viewer.answer("from:consents", { data: [{ version: "2026-10-draft", agreed_at: "2026-10-01T08:00:00+00:00" }] });
    seam.sessions = [{ key: "", accountId: "user-1", createdAt: "2026-10-01T08:00:00.000Z", expiresAt: "2026-11-19T06:30:00.000Z" }];
    const exported = await exportAccountData("user-1", NOW);
    expect(exported?.account).toEqual({
      email: "thandi@vossie.net",
      firstName: "Thandi",
      campus: "pretoria",
      roles: ["mentor"],
      memberSince: "2026-10-01T08:00:00.000Z",
      shop: null,
    });
    expect(exported?.consents).toEqual([{ policy: "2026-10-draft", agreedAt: "2026-10-01T08:00:00.000Z" }]);
    expect(exported?.sessions).toEqual([{ signedInAt: "2026-10-01T08:00:00.000Z", expiresAt: "2026-11-19T06:30:00.000Z" }]);
    const sample = await Sample.exportAccountData("acc-student", NOW);
    expect(Object.keys(exported!)).toEqual(Object.keys(sample!));
  });

  it("is null for an account that has gone", async () => {
    expect(await exportAccountData("user-1", NOW)).toBeNull();
  });
});

describe("deleting an account (decision 8; amendment 7)", () => {
  it("forgets it, removes its photo files, then deletes the Auth user", async () => {
    server.answer("rpc:forget_account", { data: ["user-1/a.webp", "user-1/b.webp"] });
    await deleteAccountData("user-1");
    expect(server.calls).toEqual([
      ["rpc", "forget_account", { p_account_id: "user-1" }],
      ["storage.remove", "photos", ["user-1/a.webp", "user-1/b.webp"]],
      ["auth.admin.deleteUser", "user-1", false],
    ]);
  });

  it("removes files through photos.ts's shared removePhotoFiles, in 100s, and none when there are none (C5)", async () => {
    server.answer("rpc:forget_account", { data: Array.from({ length: 2_001 }, (_, i) => `user-1/${i}.webp`) });
    await deleteAccountData("user-1");
    expect(server.calls.filter((call) => call[0] === "storage.remove").map((call) => (call[2] as string[]).length)).toEqual([
      ...Array.from({ length: 20 }, () => 100),
      1,
    ]);
    const empty = fakeSupabase();
    seam.server = empty.client;
    empty.answer("rpc:forget_account", { data: [] });
    await deleteAccountData("user-1");
    expect(empty.calls.some((call) => call[0] === "storage.remove")).toBe(false);
  });

  it("tries forget_account once more after a deadlock, and only then", async () => {
    server.answer("rpc:forget_account", { error: { code: "40P01", message: "deadlock" } }, { data: [] });
    await deleteAccountData("user-1");
    expect(server.calls.filter((call) => call[1] === "forget_account")).toHaveLength(2);

    const twice = fakeSupabase();
    seam.server = twice.client;
    twice.answer("rpc:forget_account", { error: { code: "40P01" } }, { error: { code: "40P01" } });
    await expect(deleteAccountData("user-1")).rejects.toThrow("forget_account failed (40P01)");
    expect(twice.calls.some((call) => call[0] === "auth.admin.deleteUser")).toBe(false);

    const other = fakeSupabase();
    seam.server = other.client;
    other.answer("rpc:forget_account", { error: { code: "XX000" } });
    await expect(deleteAccountData("user-1")).rejects.toThrow("forget_account failed (XX000)");
    expect(other.calls.filter((call) => call[1] === "forget_account")).toHaveLength(1);
  });

  it("doesn't throw once forget_account has succeeded: a file or Auth failure is logged with no id, path or address", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    server.answer("rpc:forget_account", { data: ["user-1/a.webp"] });
    server.answer("storage:photos", { error: { statusCode: "503", message: "down" } });
    server.answer("auth.admin.deleteUser", { error: { status: 500, message: "down" } });
    await expect(deleteAccountData("user-1")).resolves.toBeUndefined();
    const logged = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("photo files not removed (503, 1)");
    expect(logged).toContain("500");
    for (const secret of ["user-1", "a.webp", "@"]) expect(logged).not.toContain(secret);
  });
});
